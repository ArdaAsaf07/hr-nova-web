const pool=require('../db');
function employeeEducationSync(req,res,next){
    if(req.method!=='POST'||!['Aldı','Almadı'].includes(req.body?.education_status))return next();
    const status=req.body.education_status;
    const trainingName=String(req.body.training_name||'İş Sağlığı ve Güvenliği Eğitimi').trim().slice(0,255)||'İş Sağlığı ve Güvenliği Eğitimi';
    res.once('finish',async()=>{if(res.statusCode<300||res.statusCode>=400)return;try{
        let employeeId=String(req.path||'').match(/^\/(\d+)\/update$/)?.[1];
        if(!employeeId){const found=await pool.query(`SELECT id FROM employees WHERE LOWER(TRIM(first_name))=LOWER(TRIM($1)) AND LOWER(TRIM(last_name))=LOWER(TRIM($2)) ORDER BY created_at DESC,id DESC LIMIT 1`,[String(req.body.first_name||''),String(req.body.last_name||'')]);employeeId=found.rows[0]?.id;}
        if(!employeeId)return;
        await pool.query('UPDATE employees SET education_status=$1 WHERE id=$2',[status,employeeId]);
        const catalog=await pool.query(`INSERT INTO training_catalog(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET is_active=TRUE RETURNING id`,[trainingName]);
        await pool.query(`INSERT INTO employee_training_status(employee_id,training_catalog_id,status,completed_at) VALUES($1,$2,$3::varchar,CASE WHEN $3::varchar='Aldı' THEN CURRENT_DATE ELSE NULL END) ON CONFLICT(employee_id,training_catalog_id) DO UPDATE SET status=EXCLUDED.status,completed_at=CASE WHEN EXCLUDED.status='Aldı' THEN COALESCE(employee_training_status.completed_at,CURRENT_DATE) ELSE NULL END,updated_at=NOW()`,[employeeId,catalog.rows[0].id,status]);
    }catch(error){console.error('Personel eğitim eşitleme hatası:',error.message);}});
    next();
}
module.exports={employeeEducationSync};
