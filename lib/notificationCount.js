const pool=require("../db");
async function notificationCount(req,res,next){try{const r=await pool.query(`SELECT COUNT(*)::int AS count FROM trainings WHERE (end_date<CURRENT_DATE OR start_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '30 days') AND LOWER(COALESCE(status,'')) NOT IN ('tamamlandı','iptal edildi')`);res.locals.notificationCount=r.rows[0].count;}catch(e){res.locals.notificationCount=0;}next();}
module.exports={notificationCount};
