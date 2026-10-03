require("dotenv").config();
const crypto=require("crypto"),fs=require("fs"),path=require("path");
const envPath=path.join(__dirname,"..",".env"),current=fs.readFileSync(envPath,"utf8");
if(/^PERSONAL_DATA_ENCRYPTION_KEY=.+$/m.test(current)){console.log("Şifreleme anahtarı zaten mevcut; değiştirilmedi.");process.exit(0);}
const line=`PERSONAL_DATA_ENCRYPTION_KEY=${crypto.randomBytes(32).toString("base64")}`;
fs.writeFileSync(envPath,/^PERSONAL_DATA_ENCRYPTION_KEY=/m.test(current)?current.replace(/^PERSONAL_DATA_ENCRYPTION_KEY=.*$/m,line):`${current.trimEnd()}\n${line}\n`,{encoding:"utf8",mode:0o600});
console.log("Şifreleme anahtarı .env dosyasına güvenli biçimde oluşturuldu.");
