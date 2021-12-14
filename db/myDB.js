const {MongoClient} = require("mongodb");
const {createClient} = require("redis");

async function getRConnection() {
  let rclient = createClient();
  rclient.on("error", (err) => console.log("Redis Client Error", err));
  await rclient.connect();

  // console.log("redis connected");
  return rclient;
}

async function getCourses() {
  const uri = process.env.MONGO_URL || "mongodb://localhost:27017";
  const mongoClient = new MongoClient(uri);

  try {
    await mongoClient.connect();
    const db = mongoClient.db("driveSchool");
    let collection = db.collection("courses");
    let query = {
    };
    let res = await collection.find(query).toArray();
    return res;
    // console.log(res.length);
  } catch(err){
    console.log(err);
  } finally {
    mongoClient.close();
  }
}

async function getCoach(coachID){
  let redisClient;
  try{
    redisClient = await getRConnection();
    return await redisClient.hGetAll(`${coachID}`);
  }finally {
    redisClient.quit();
  }
}

async function getCoaches() {
  let redisClient;
  try{
    redisClient = await getRConnection();
    console.log("redis connected");

    const ids = await redisClient.lRange("coaches", 0, -1);
    console.log("coaches total", ids.length);
    const coaches = [];
    for (let id of ids){
      const coach = await getCoach(id);
      coaches.push(coach);
    }
    return coaches;
  }finally {
    redisClient.quit();
  }
}

async function insertCoach(coach){
  let redisClient;
  try{
    redisClient = await getRConnection();
    const nextID = await redisClient.incr("coachesCount");
    console.log("creating coach", nextID, coach);

    const key = `coach:${nextID}`;
    const dateTime = await getDateTime();
    await redisClient.hSet(key, {
    coachID: `${nextID}`,
    firstName: coach.firstName,
    lastName: coach.lastName,
    phoneNumber: coach.phoneNumber,
    location: coach.location,
    registerOn: dateTime,
    ratings: coach.ratings
    });

    await redisClient.rPush("coaches", key);

  }finally {
    redisClient.quit();
  }
}

async function getBestCoach() {
  const coaches = await getCoaches();
  console.log("coaches count ", coaches.length) ;

  let redisClient;
  try {
    redisClient = await getRConnection();
    console.log("redis connected");

    let points = 0;
    for (let coach of coaches){
        //incr
      points = await parseFloat(coach.ratings);
      await redisClient.zAdd("testLeaderboard", {score: points, value: ""+ JSON.stringify(coach)});
    }
    // const output = await redisClient.zRangeWithScores("CoachLeaderboard", 0, -1, {REV: 1});
    const output = await redisClient.zRangeWithScores("testLeaderboard", 0, -1, {REV: 1});
    // 
    let lst = []
    for (let out of output){
      // console.log(out.value);
      const obj = JSON.parse(out.value)
      lst.push(obj);
      // console.log(obj.coachID, obj.ratings);
    }
    // console.log(lst);
    return lst;

  } finally {
    redisClient.quit();
  }

}

async function getDateTime(){
  let today = await new Date();
  let date = await today.getFullYear()+ '-'+ (today.getMonth()+ 1)+ '-'+ today.getDate();
  let time = await today.getHours()+ ':'+ today.getMinutes()+ ':'+ today.getSeconds();
  console.log(date,time);
  return date+ ' '+ time;
}

async function runIt() {
  const courses = await getCourses();
  console.log("courses count ", courses.length) ;

  let redisClient;
  try {
    redisClient = await getRConnection();

    await redisClient.SET("courseCount", "0");
    for (let course of courses){
        //incr
        await redisClient.incr("courseCount");
      
    }
    
    const count = await redisClient.get("courseCount");
    console.log("There were", count, "courses");
  } finally {
    redisClient.quit();
  }
  
}
// getBestCoach();
// getDateTime();
module.exports.insertCoach = insertCoach;
module.exports.getBestCoach = getBestCoach;
