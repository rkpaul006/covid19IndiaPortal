const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "NEXT_WAVE", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

const convertObj3 = (dbObj) => {
  return {
    stateId: dbObj.state_id,
    stateName: dbObj.state_name,
    population: dbObj.population,
  };
};

const convertObj5 = (dbObj) => {
  return {
    districtId: dbObj.district_id,
    districtName: dbObj.district_name,
    stateId: dbObj.state_id,
    cases: dbObj.cases,
    cured: dbObj.cured,
    active: dbObj.active,
    deaths: dbObj.deaths,
  };
};
//API-1//
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `
        SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(userQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "NEXT_WAVE");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

//API-2//
app.get("/states/", authenticateToken, async (request, response) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send("No Access Token");
  } else {
    jwt.verify(jwtToken, "NEXT_WAVE", async (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
      } else {
        const getStatesQuery = `
            SELECT 
               * 
            FROM state ORDER BY state_id;`;
        const statesArray = await db.all(getStatesQuery);
        response.send(statesArray.map((each) => convertObj3(each)));
      }
    });
  }
});

//API-3//
app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT 
           * 
        FROM state
        WHERE 
        state_id = ${stateId};`;
  const statesArray = await db.get(getStateQuery);
  response.send(convertObj3(statesArray));
});
//API-4//
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const districtQuery = `
        INSERT 
          INTO district ( district_name, state_id, cases, cured, active, deaths)
          VALUES (
              "${districtName}",
              "${stateId}",
              "${cases}",
              "${cured}",
              "${active}",
              "${deaths}"
              );`;
  await db.run(districtQuery);
  response.send("District Successfully Added");
});
//API-5//
app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT 
           * 
        FROM district
        WHERE 
        district_id = ${districtId};`;
    const districtArray = await db.get(getDistrictQuery);
    response.send(convertObj5(districtArray));
  }
);
//API-6//
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        DELETE
        FROM district
        WHERE 
        district_id = ${districtId};`;
    const districtArray = await db.run(getDistrictQuery);
    response.send("District Removed");
  }
);
//API-7//
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const districtQuery = `
    UPDATE district SET 
    district_name = "${districtName}",
    state_id = "${stateId}",
    cases = "${cases}",
    cured = "${cured}",
    active = "${active}",
    deaths = "${deaths}"
    WHERE district_id = "${districtId}";`;
    const districtUpdate = await db.run(districtQuery);
    response.send("District Details Updated");
  }
);
//API-8//
app.get(
  "/states/:stateId/stats",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStats = `
    SELECT 
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
    FROM 
      district
    WHERE 
        state_id = ${stateId};`;
    const stats = await db.get(getStats);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
