import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const SCRYPT_N=16384, SCRYPT_R=8, SCRYPT_P=1, KEY_LENGTH=64, SALT_LENGTH=16;
const LOGIN_WINDOW_MS=15*60*1000, MAX_LOGIN_FAILURES=8;
const VALID_ROLES=new Set(["admin","manager","operator","viewer"]);
const ROLE_PERMISSIONS=Object.freeze({
 admin:["*"],
 manager:["data:read","data:write"],
 operator:["data:read","data:write"],
 viewer:["data:read"]
});
function derive(password,salt){return new Promise((resolve,reject)=>scrypt(password,salt,KEY_LENGTH,{N:SCRYPT_N,r:SCRYPT_R,p:SCRYPT_P,maxmem:64*1024*1024},(err,key)=>err?reject(err):resolve(key)));}
export async function hashPassword(password){
 if(typeof password!=="string"||password.length<12||password.length>256)throw new Error("Password must contain 12 to 256 characters.");
 const salt=randomBytes(SALT_LENGTH),key=await derive(password,salt);
 return ["scrypt",SCRYPT_N,SCRYPT_R,SCRYPT_P,salt.toString("hex"),key.toString("hex")].join("$");
}
function parsePasswordHash(value){
 if(typeof value!=="string")return null;
 const parts=value.split("$");if(parts.length!==6||parts[0]!=="scrypt")return null;
 const [,n,r,p,saltHex,keyHex]=parts;
 if(Number(n)!==SCRYPT_N||Number(r)!==SCRYPT_R||Number(p)!==SCRYPT_P)return null;
 if(!/^[a-f0-9]{32}$/i.test(saltHex)||!/^[a-f0-9]{128}$/i.test(keyHex))return null;
 return {salt:Buffer.from(saltHex,"hex"),key:Buffer.from(keyHex,"hex")};
}
async function verifyPassword(password,encoded){
 const parsed=parsePasswordHash(encoded);if(!parsed||typeof password!=="string"||password.length>256)return false;
 const actual=await derive(password,parsed.salt);return actual.length===parsed.key.length&&timingSafeEqual(actual,parsed.key);
}
function safeUser(user){return {id:user.id,username:user.username,role:user.role,companyIds:user.companyIds||[],factoryIds:user.factoryIds||[]};}
function parseUsers(usersJson){
 if(typeof usersJson!=="string"||!usersJson.trim())return [];
 let rows;try{rows=JSON.parse(usersJson);}catch{throw new Error("AXIMACH_AUTH_USERS must be valid JSON.");}
 if(!Array.isArray(rows)||rows.length<1||rows.length>500)throw new Error("AXIMACH_AUTH_USERS must be an array containing 1 to 500 user records.");
 const ids=new Set(),usernames=new Set();
 return rows.map((row,index)=>{
  if(!row||typeof row!=="object"||Array.isArray(row))throw new Error(`Invalid auth user at index ${index}.`);
  const id=String(row.id||"").trim(),username=String(row.username||"").trim().toLowerCase(),role=String(row.role||"");
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(id))throw new Error(`Auth user ${index} has an invalid id.`);
  if(!/^[a-z0-9._-]{3,64}$/.test(username))throw new Error(`Auth user ${id} has an invalid username.`);
  if(!VALID_ROLES.has(role))throw new Error(`Auth user ${id} has an invalid role.`);
  if(!parsePasswordHash(row.passwordHash))throw new Error(`Auth user ${id} must have a valid scrypt passwordHash; plaintext passwords are not accepted.`);
  if(row.active!==undefined&&typeof row.active!=="boolean")throw new Error(`Auth user ${id} has an invalid active flag.`);
  const validateScopeIds=(value,label)=>{if(value===undefined)return [];if(!Array.isArray(value)||value.length>1000||value.some(item=>typeof item!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(item)))throw new Error(`Auth user ${id} has invalid ${label}.`);return [...new Set(value)];};
  const companyIds=validateScopeIds(row.companyIds,"companyIds"),factoryIds=validateScopeIds(row.factoryIds,"factoryIds");
  if(ids.has(id)||usernames.has(username))throw new Error("AXIMACH_AUTH_USERS contains duplicate IDs or usernames.");
  ids.add(id);usernames.add(username);
  return {id,username,role,passwordHash:row.passwordHash,active:row.active!==false,companyIds,factoryIds};
 });
}
export function createAuthService(usersJson,options={}){
 const users=parseUsers(usersJson);if(!users.length)return null;
 const ttl=Number(options.sessionTtlMs??12*60*60*1000);
 if(!Number.isSafeInteger(ttl)||ttl<5*60*1000||ttl>7*24*60*60*1000)throw new Error("AXIMACH_SESSION_TTL_MS must be between 5 minutes and 7 days.");
 const usersByName=new Map(users.map(user=>[user.username,user])),sessions=new Map(),failuresByAddress=new Map();
 const dummySalt=randomBytes(SALT_LENGTH),dummyHash=["scrypt",SCRYPT_N,SCRYPT_R,SCRYPT_P,dummySalt.toString("hex"),randomBytes(KEY_LENGTH).toString("hex")].join("$");
 const tokenDigest=token=>createHash("sha256").update(token).digest("hex");
 function cleanExpired(now=Date.now()){
  for(const [digest,session] of sessions)if(session.expiresAt<=now)sessions.delete(digest);
  for(const [address,attempts] of failuresByAddress){const current=attempts.filter(at=>now-at<LOGIN_WINDOW_MS);if(current.length)failuresByAddress.set(address,current);else failuresByAddress.delete(address);}
 }
 return {
  mode:"users",
  async login(usernameInput,password,address="unknown"){
   const now=Date.now();cleanExpired(now);const client=String(address||"unknown").slice(0,128);
   const failures=failuresByAddress.get(client)||[];if(failures.length>=MAX_LOGIN_FAILURES)return {ok:false,rateLimited:true};
   const user=usersByName.get(String(usernameInput||"").trim().toLowerCase());
   const passwordOk=await verifyPassword(password,user?.passwordHash||dummyHash);
   if(!user||!user.active||!passwordOk){const next=[...failures,now].filter(at=>now-at<LOGIN_WINDOW_MS);failuresByAddress.set(client,next);return {ok:false,rateLimited:next.length>=MAX_LOGIN_FAILURES};}
   failuresByAddress.delete(client);const token=randomBytes(32).toString("base64url"),expiresAt=now+ttl;
   sessions.set(tokenDigest(token),{userId:user.id,expiresAt});
   return {ok:true,token,expiresAt:new Date(expiresAt).toISOString(),user:safeUser(user)};
  },
  authenticate(token){
   if(typeof token!=="string"||token.length<32||token.length>256)return null;
   cleanExpired();const digest=tokenDigest(token),session=sessions.get(digest);if(!session)return null;
   const user=users.find(row=>row.id===session.userId&&row.active);if(!user){sessions.delete(digest);return null;}
   return {user:safeUser(user),expiresAt:new Date(session.expiresAt).toISOString()};
  },
  logout(token){if(typeof token!=="string"||token.length<32||token.length>256)return false;return sessions.delete(tokenDigest(token));}
 };
}
export function bearerToken(req){const match=/^Bearer\s+([A-Za-z0-9_-]{32,256})$/i.exec(String(req.headers.authorization||""));return match?match[1]:"";}
export function getRequiredPermission(pathname,method){
 const verb=String(method||"").toUpperCase();
 if(pathname==="/api/backup"&&verb==="GET")return "backup:read";
 if(pathname==="/api/restore"&&verb==="POST")return "backup:restore";
 if(pathname==="/api/manufacturing-data")return verb==="GET"?"data:read":"data:write";
 if(pathname==="/api/records")return verb==="GET"?"records:read":"records:write";
 if(pathname==="/api/ui-preferences")return verb==="GET"?"preferences:read":"preferences:write";
 if(pathname==="/api/contacts")return verb==="GET"?"contacts:read":"contacts:write";
 if(pathname==="/api/schedules")return verb==="GET"?"schedules:read":"schedules:write";
 if(/^\/api\/schedules\/[\w-]+$/.test(pathname)&&verb==="PATCH")return "schedules:write";
 if(pathname==="/api/logs"&&verb==="GET")return "logs:read";
 return "admin:only";
}
export function hasPermission(user,permission){
 if(user?.legacy===true)return true;const granted=ROLE_PERMISSIONS[user?.role]||[];
 return granted.includes("*")||granted.includes(permission);
}
