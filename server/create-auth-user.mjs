import { randomUUID } from "node:crypto";
import { hashPassword } from "./auth.mjs";
function readSecret(prompt){
 if(!process.stdin.isTTY||typeof process.stdin.setRawMode!=="function")throw new Error("Run this command in an interactive terminal so the password is not echoed.");
 process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding("utf8");
 return new Promise((resolve,reject)=>{
  let value="";const finish=error=>{process.stdin.setRawMode(false);process.stdin.pause();process.stdin.removeListener("data",onData);process.stdout.write("\n");if(error)reject(error);else resolve(value);};
  const onData=chunk=>{for(const char of chunk){if(char==="\u0003")return finish(new Error("Cancelled."));if(char==="\r"||char==="\n")return finish();if(char==="\u007f"||char==="\b"){value=value.slice(0,-1);process.stdout.write("\b \b");}else if(char>=" "&&char!=="\u007f"){value+=char;process.stdout.write("*");}}};
  process.stdin.on("data",onData);
 });
}
const args=Object.fromEntries(process.argv.slice(2).map(value=>{const i=value.indexOf("=");return i<0?[value.replace(/^--/,""),""]:[value.slice(0,i).replace(/^--/,""),value.slice(i+1)];}));
const username=String(args.username||"").trim().toLowerCase(),role=String(args.role||"operator");
if(!/^[a-z0-9._-]{3,64}$/.test(username))throw new Error("Provide --username= with 3 to 64 letters, numbers, dots, underscores or hyphens.");
if(!["admin","manager","operator","viewer"].includes(role))throw new Error("Role must be admin, manager, operator or viewer.");
const password=await readSecret("New password (12+ characters): "),confirmation=await readSecret("Confirm password: ");
if(password!==confirmation)throw new Error("Passwords do not match.");
const passwordHash=await hashPassword(password);
process.stdout.write(JSON.stringify([{id:randomUUID(),username,passwordHash,role,active:true}],null,2)+"\n");
