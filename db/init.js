const {MongoClient} = require("mongodb");
const {createClient} = require("redis");

async function getRConnection() {
  let rclient = createClient();
  rclient.on("error", (err) => console.log("Redis Client Error", err));
  await rclient.connect();

  console.log("redis connected");
  return rclient;
}

async function getCoaches() {
  const uri = process.env.MONGO_URL || "mongodb://localhost:27017";
  const mongoClient = new MongoClient(uri);

  try {
    await mongoClient.connect();
    const db = mongoClient.db("driveSchool");
    let collection = db.collection("coaches");
    let query = {
    };
    let res = await collection.find(query).toArray();
    return res;
    // console.log("coaches count", res.length);
  } catch(err){
    console.log(err);
  } finally {
    mongoClient.close();
  }
}

async function loadCoaches(){
  const coaches = await getCoaches();
  let redisClient;
  try {
    redisClient = await getRConnection();
    await redisClient.set("coachesCount", "0");
    for (let coach of coaches){
      const key = `coach:${coach.coachID}`;
      await redisClient.hSet(key, {
      coachID: coach.coachID,
      firstName: coach.firstName,
      lastName: coach.lastName,
      phoneNumber: coach.phoneNumber,
      location: coach.location,
      registerOn: coach.registerOn,
      ratings: coach.ratings
      });
      await redisClient.rPush("coaches", key);
      await redisClient.incr("coachesCount");
    }
    console.log("coaches loaded");

  } finally {
    redisClient.quit();
  }
}

loadCoaches();
