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
  console.log("get");
  const authHeader = request.header["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    console.log(jwtToken);
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token1");
  } else {
    jwt.verify(jwtToken, "NEXT_WAVE", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token2");
      } else {
        next();
      }
    });
  }
};

//API-1//
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `
        SELECT * FROM user WHERE username = '${username}';`;
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
app.get("/states/", (request, response) => {
  let jwtToken;
  const authHeader = request.header["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
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
        response.send(statesArray);
      }
    });
  }
});

//API-3//
app.get(
  "/states/:stateId",
  authenticateToken,
  async (request, response, next) => {
    const { stateId } = request.body;
    const getStateQuery = `
        SELECT 
           * 
        FROM state
        WHERE 
        stateId = '${stateId}';`;
    const statesArray = await db.get(getStateQuery);
    response.send(statesArray);
  }
);

module.exports = app;
