require("dotenv").config();
const pool=require("../db");
Promise.all([pool.query(`SELECT COALESCE(education_status,'Boş') status,COUNT(*)::int count FROM employees GROUP BY education_status ORDER BY count DESC`),pool.query(`SELECT column_name,is_nullable,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='trainings' ORDER BY ordinal_position`)]).then(([a,b])=>console.log(JSON.stringify({statusCounts:a.rows,trainingColumns:b.rows}))).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
