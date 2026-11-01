import { useMemo, useState } from "react";
import { saveBlobFile } from "./fileDownload";
import { ArrowRight, Check, Download, FileDown, FileUp, Package, Printer, Search, ShieldCheck, Upload, X } from "lucide-react";
import {
  activeRows, makeId, nowIso, useManufacturingData,
  type CompanyRecord, type ComponentRecord, type MaterialRecord, type ProcessCategoryRecord, type ProcessTypeRecord, type VendorRecord
} from "./manufacturingData";

type Props = { mode: "export" | "import"; onBack: () => void; onNotice: (value: string) => void; notice:string };
type DataKey = "companies"|"purchaseOrders"|"components"|"vendors"|"operations"|"processCategories"|"processTypes"|"processVendorRates"|"materials"|"bomLines"|"quotations"|"qualityInspections"|"inventoryTransactions"|"wipTransfers"|"customerDispatches"|"machineResources"|"maintenanceEvents";
type ImportKind = "companies"|"components"|"vendors"|"materials"|"processCategories"|"processTypes";
type Row = Record<string, unknown>;
type Prepared = { line:number; record:Row; errors:string[] };
const exportSources: {key:DataKey;label:string;dateFields:string[]}[] = [
  {key:"companies",label:"Companies",dateFields:["createdAt","updatedAt"]},
  {key:"purchaseOrders",label:"Purchase Orders",dateFields:["issueDate","targetDelivery","createdAt"]},
  {key:"components",label:"Components",dateFields:["createdAt","updatedAt"]},
  {key:"vendors",label:"Vendors",dateFields:["createdAt","updatedAt"]},
  {key:"processCategories",label:"Process categories",dateFields:["createdAt","updatedAt"]},
  {key:"processTypes",label:"Process types",dateFields:["createdAt","updatedAt"]},
  {key:"processVendorRates",label:"Process vendor rates",dateFields:["quotedAt","validFrom","validUntil"]},
  {key:"operations",label:"Process operations",dateFields:["plannedStart","plannedEnd","updatedAt"]},
  {key:"quotations",label:"PO operation quotations",dateFields:["quotedAt","validUntil"]},
  {key:"materials",label:"Materials",dateFields:["createdAt","updatedAt"]},
  {key:"bomLines",label:"BOM lines",dateFields:["createdAt","updatedAt"]},
  {key:"qualityInspections",label:"Quality inspections",dateFields:["inspectionDate","createdAt"]},
  {key:"inventoryTransactions",label:"Stock ledger",dateFields:["occurredAt","createdAt"]},
  {key:"wipTransfers",label:"WIP transfers",dateFields:["preparedAt","dispatchedAt","lastReceivedAt"]},
  {key:"customerDispatches",label:"Customer dispatches",dateFields:["dispatchDate","actualDispatchDate","lastDeliveryDate"]},
  {key:"machineResources",label:"Machine resources (legacy/internal)",dateFields:["createdAt","updatedAt"]},
  {key:"maintenanceEvents",label:"Maintenance events",dateFields:["plannedStartAt","plannedEndAt","createdAt"]}
];
const templates: {kind:ImportKind;label:string;headers:string[];key:string;description:string}[] = [
  {kind:"companies",label:"Companies",headers:["name","gstin","phone","email","notes"],key:"name / GSTIN",description:"Company master only. Duplicate name or GSTIN is rejected."},
  {kind:"components",label:"Components",headers:["partNumber","name","revision","material","drawingReference","notes","salePrice"],key:"part number + revision",description:"Component masters only. Numeric costing fields not supplied by CSV remain zero / not entered."},
  {kind:"vendors",label:"Vendors",headers:["company","contact","processTypeId","role","phone","whatsappNumber","email","address","machines","materials","notes","status"],key:"phone / WhatsApp or company + contact",description:"Each vendor must reference exactly one existing Process Directory type."},
  {kind:"materials",label:"Materials",headers:["code","name","grade","unit","specification","preferredVendorId","ratePerUnit","notes"],key:"material code",description:"Preferred vendor ID must already exist if provided."},
  {kind:"processCategories",label:"Process categories",headers:["name","code","description"],key:"category name",description:"New category records only."},
  {kind:"processTypes",label:"Process types",headers:["categoryId","name","code","description"],key:"category ID + type name",description:"categoryId must match an existing Process Directory category."}
];
const today=()=>new Date().toISOString().slice(0,10);
const csvCell=(value:unknown)=>{let text=typeof value==="string"?value:value==null?"":typeof value==="object"?JSON.stringify(value):String(value);if(typeof value==="string"&&/^[\\u0000-\\u0020]*[=+@-]/.test(text))text="'"+text;return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;};
function rowsToCsv(rows:Row[]) {
  const headers=Array.from(new Set(rows.flatMap(row=>Object.keys(row))));
  return [headers.map(csvCell).join(","),...rows.map(row=>headers.map(key=>csvCell(row[key])).join(","))].join("\r\n");
}
async function readZipEntry(zip:Uint8Array,target:string):Promise<string|null>{
  const view=new DataView(zip.buffer,zip.byteOffset,zip.byteLength);
  let endOffset=-1;
  for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--){if(view.getUint32(i,true)===0x06054b50){endOffset=i;break;}}
  if(endOffset<0)throw new Error("This Excel file does not contain a valid ZIP workbook directory.");
  const count=view.getUint16(endOffset+10,true),centralOffset=view.getUint32(endOffset+16,true);
  const decoder=new TextDecoder();let cursor=centralOffset;
  for(let index=0;index<count;index++){
    if(view.getUint32(cursor,true)!==0x02014b50)throw new Error("The Excel workbook directory is invalid.");
    const method=view.getUint16(cursor+10,true),compressedSize=view.getUint32(cursor+20,true);
    const nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true);
    const localOffset=view.getUint32(cursor+42,true);
    const name=decoder.decode(zip.subarray(cursor+46,cursor+46+nameLength));
    cursor+=46+nameLength+extraLength+commentLength;
    if(name!==target)continue;
    if(view.getUint32(localOffset,true)!==0x04034b50)throw new Error("An Excel workbook entry has an invalid local header.");
    const localNameLength=view.getUint16(localOffset+26,true),localExtraLength=view.getUint16(localOffset+28,true);
    const dataOffset=localOffset+30+localNameLength+localExtraLength;
    const compressed=zip.subarray(dataOffset,dataOffset+compressedSize);
    if(method===0)return decoder.decode(compressed);
    if(method===8){
      if(typeof DecompressionStream==="undefined")throw new Error("This browser cannot decompress Excel workbooks. Save the sheet as CSV and import that file instead.");
      const buffer=compressed.slice().buffer as ArrayBuffer;
      const stream=new Blob([buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
      return decoder.decode(await new Response(stream).arrayBuffer());
    }
    throw new Error("This Excel workbook uses an unsupported compression method.");
  }
  return null;
}
function excelCellColumn(reference:string):number{
  const letters=reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase()||"A";
  let result=0;for(const char of letters)result=result*26+(char.charCodeAt(0)-64);return Math.max(0,result-1);
}
function excelXmlRows(xml:string,sharedStrings:string[]):string[][]{
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.getElementsByTagName("parsererror").length)throw new Error("The Excel worksheet XML could not be read.");
  return Array.from(doc.getElementsByTagName("row")).map(row=>{
    const values:string[]=[];
    Array.from(row.getElementsByTagName("c")).forEach(cell=>{
      const reference=cell.getAttribute("r")||"A1",column=excelCellColumn(reference),type=cell.getAttribute("t")||"";
      const value=cell.getElementsByTagName("v")[0]?.textContent||"";
      let text=value;
      if(type==="s")text=sharedStrings[Number(value)]??"";
      else if(type==="inlineStr")text=Array.from(cell.getElementsByTagName("t")).map(node=>node.textContent||"").join("");
      else if(type==="b")text=value==="1"?"true":"false";
      values[column]=text;
    });
    return values.map(value=>value??"");
  });
}
async function parseXlsx(file:File):Promise<string[][]>{
  const bytes=new Uint8Array(await file.arrayBuffer());
  const workbookXml=await readZipEntry(bytes,"xl/workbook.xml");
  const relationshipsXml=await readZipEntry(bytes,"xl/_rels/workbook.xml.rels");
  if(!workbookXml||!relationshipsXml)throw new Error("The Excel file is missing workbook or relationship metadata.");
  const workbook=new DOMParser().parseFromString(workbookXml,"application/xml");
  const relationships=new DOMParser().parseFromString(relationshipsXml,"application/xml");
  const sheet=workbook.getElementsByTagName("sheet")[0];
  const relationshipId=sheet?.getAttribute("r:id")||"";
  if(!relationshipId)throw new Error("No worksheet was found in this Excel workbook.");
  const relation=Array.from(relationships.getElementsByTagName("Relationship")).find(item=>item.getAttribute("Id")===relationshipId);
  const target=relation?.getAttribute("Target");
  if(!target)throw new Error("The first worksheet target is missing from the workbook relationships.");
  const sheetPath=target.startsWith("/")?target.slice(1):target.startsWith("xl/")?target:"xl/"+target.replace(/^\.\//,"");
  const sheetXml=await readZipEntry(bytes,sheetPath);
  if(!sheetXml)throw new Error("The first worksheet could not be found in the Excel workbook.");
  const sharedXml=await readZipEntry(bytes,"xl/sharedStrings.xml");
  const sharedStrings=sharedXml?Array.from(new DOMParser().parseFromString(sharedXml,"application/xml").getElementsByTagName("si")).map(item=>Array.from(item.getElementsByTagName("t")).map(node=>node.textContent||"").join("")):[];
  return excelXmlRows(sheetXml,sharedStrings).filter(row=>row.some(cell=>cell.trim()!==""));
}
async function parseUploadedFile(file:File):Promise<string[][]>{
  const name=file.name.toLowerCase();
  if(name.endsWith(".xlsx")||name.endsWith(".xlsm"))return parseXlsx(file);
  if(name.endsWith(".csv"))return parseCsv(await file.text());
  throw new Error("Use a CSV file or an Excel .xlsx/.xlsm workbook. Legacy .xls files are not supported; save them as .xlsx or CSV first.");
}
function parseCsv(source:string):string[][] {
  const rows:string[][]=[];let row:string[]=[];let value="";let quoted=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(quoted){if(ch==='"'&&source[i+1]==='"'){value+='"';i++;}else if(ch==='"'){quoted=false;}else value+=ch;continue;}
    if(ch==='"'&&value===""){quoted=true;continue;}
    if(ch===","){row.push(value);value="";continue;}
    if(ch==="\n"){row.push(value.replace(/\r$/,""));rows.push(row);row=[];value="";continue;}
    value+=ch;
  }
  if(quoted)throw new Error("CSV has an unclosed quoted field.");
  if(value.length||row.length){row.push(value.replace(/\r$/,""));rows.push(row);}
  return rows.filter(item=>item.some(cell=>cell.trim()!==""));
}
const norm=(value:unknown)=>String(value??"").trim().toLowerCase().replace(/\s+/g," ");
const numeric=(value:unknown,label:string,errors:string[])=>{const raw=String(value??"").trim();if(!raw)return 0;const parsed=Number(raw);if(!Number.isFinite(parsed)||parsed<0)errors.push(label+" must be a non-negative number.");return Number.isFinite(parsed)&&parsed>=0?parsed:0;};
const csvTemplate=(headers:string[])=>headers.map(csvCell).join(",")+"\r\n";
const xmlEscape=(value:string)=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const excelColumn=(index:number)=>{let n=index+1,result="";while(n>0){const digit=(n-1)%26;result=String.fromCharCode(65+digit)+result;n=Math.floor((n-1)/26);}return result;};
function zipStored(files:{name:string;content:string}[]):ArrayBuffer{
  const encoder=new TextEncoder(),localParts:Uint8Array[]=[],centralParts:Uint8Array[]=[];
  const crc=(bytes:Uint8Array)=>{let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;};
  let localOffset=0,centralSize=0;
  for(const file of files){
    const name=encoder.encode(file.name),body=encoder.encode(file.content),checksum=crc(body);
    const local=new Uint8Array(30+name.length+body.length),lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0,true);lv.setUint16(8,0,true);
    lv.setUint16(10,0,true);lv.setUint16(12,0x21,true);lv.setUint32(14,checksum,true);
    lv.setUint32(18,body.length,true);lv.setUint32(22,body.length,true);lv.setUint16(26,name.length,true);lv.setUint16(28,0,true);
    local.set(name,30);local.set(body,30+name.length);localParts.push(local);
    const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0,true);cv.setUint16(10,0,true);
    cv.setUint16(12,0,true);cv.setUint16(14,0x21,true);cv.setUint32(16,checksum,true);cv.setUint32(20,body.length,true);cv.setUint32(24,body.length,true);
    cv.setUint16(28,name.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);
    cv.setUint32(38,0,true);cv.setUint32(42,localOffset,true);central.set(name,46);centralParts.push(central);
    localOffset+=local.length;centralSize+=central.length;
  }
  const end=new Uint8Array(22),ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);
  ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);
  ev.setUint32(16,localOffset,true);ev.setUint16(20,0,true);
  const out=new Uint8Array(localOffset+centralSize+end.length);let cursor=0;
  for(const part of localParts){out.set(part,cursor);cursor+=part.length;}
  for(const part of centralParts){out.set(part,cursor);cursor+=part.length;}
  out.set(end,cursor);
  return out.buffer;
}
function toXlsx(headers:string[],rows:Row[]):ArrayBuffer{
  const encodeCell=(value:unknown,reference:string)=>{
    if(typeof value==="number"&&Number.isFinite(value))return `<c r="${reference}"><v>${value}</v></c>`;
    if(typeof value==="boolean")return `<c r="${reference}" t="b"><v>${value?1:0}</v></c>`;
    const text=value==null?"":typeof value==="object"?JSON.stringify(value):String(value);
    return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
  };
  const sheetRows=[headers,...rows.map(row=>headers.map(header=>row[header]))];
  const sheetData=sheetRows.map((cells,rowIndex)=>`<row r="${rowIndex+1}">${cells.map((cell,index)=>encodeCell(cell,`${excelColumn(index)}${rowIndex+1}`)).join("")}</row>`).join("");
  return zipStored([
    {name:"[Content_Types].xml",content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'},
    {name:"_rels/.rels",content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:"xl/workbook.xml",content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="AXIMACH Data" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name:"xl/_rels/workbook.xml.rels",content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'},
    {name:"xl/worksheets/sheet1.xml",content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+sheetData+'</sheetData></worksheet>'}
  ]);
}


export default function DataExchangeWorkspace({mode,onBack,onNotice,notice}:Props) {
  const {data,update,syncStatus}=useManufacturingData();
  const [source,setSource]=useState<DataKey>("purchaseOrders");
  const [search,setSearch]=useState("");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [importKind,setImportKind]=useState<ImportKind>("companies");
  const [prepared,setPrepared]=useState<Prepared[]>([]);
  const [fileName,setFileName]=useState("");
  const [fileError,setFileError]=useState("");
  const [busy,setBusy]=useState(false);
  const sourceMeta=exportSources.find(item=>item.key===source)!;
  const allRows=(data[source] as unknown as Row[]).filter(row=>!row.deletedAt);
  const exportRows=useMemo(()=>allRows.filter(row=>{
    const matchesSearch=!search||JSON.stringify(row).toLowerCase().includes(search.toLowerCase().trim());
    const dateValue=sourceMeta.dateFields.map(field=>String(row[field]||"").slice(0,10)).find(Boolean)||"";
    const matchesFrom=!dateFrom||(dateValue&&dateValue>=dateFrom);
    const matchesTo=!dateTo||(dateValue&&dateValue<=dateTo);
    return matchesSearch&&matchesFrom&&matchesTo;
  }),[allRows,search,dateFrom,dateTo,sourceMeta.dateFields.join("|")]);
  const saveBlob=(filename:string,blob:Blob,successMessage:string)=>{
    void saveBlobFile(filename,blob).then(result=>{
      if(result==="cancelled"){onNotice("File save was cancelled.");return;}
      onNotice(result==="shared"?successMessage+" Choose Save to Files or Downloads in the device share sheet.":successMessage+" Download started.");
    }).catch(error=>onNotice(error instanceof Error?error.message:"Could not start the file export."));
  };
  const download=(filename:string,body:string,mime:string,successMessage="File ready.")=>saveBlob(filename,new Blob([body],{type:mime}),successMessage);
  const exportCsv=()=>{if(!exportRows.length){onNotice("No matching records to export.");return;}download("aximach-"+source+"-"+today()+".csv",rowsToCsv(exportRows),"text/csv;charset=utf-8",exportRows.length+" saved "+sourceMeta.label.toLowerCase()+" record(s) exported as CSV.");};
  const exportJson=()=>{if(!exportRows.length){onNotice("No matching records to export.");return;}download("aximach-"+source+"-"+today()+".json",JSON.stringify({source,exportedAt:nowIso(),count:exportRows.length,records:exportRows},null,2),"application/json",exportRows.length+" saved record(s) exported as JSON.");};
  const exportExcel=()=>{
    if(!exportRows.length){onNotice("No matching records to export.");return;}
    const headers=Array.from(new Set(exportRows.flatMap(row=>Object.keys(row))));
    const workbook=toXlsx(headers,exportRows);
    const blob=new Blob([workbook],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    saveBlob("aximach-"+source+"-"+today()+".xlsx",blob,exportRows.length+" saved "+sourceMeta.label.toLowerCase()+" record(s) exported as Excel workbook.");
  };
  const printPreview=()=>{if(!exportRows.length){onNotice("No matching records to print.");return;}window.print();};
  const template=templates.find(item=>item.kind===importKind)!;
  const prepareFile=async(file?:File)=>{
    if(!file)return;
    setBusy(true);setFileError("");setPrepared([]);setFileName(file.name);
    try{
      const parsed=await parseUploadedFile(file);
      if(parsed.length<2)throw new Error("CSV must contain a header row and at least one data row.");
      const headers=parsed[0].map(value=>value.trim());
      const missing=template.headers.filter(header=>!headers.includes(header));
      if(missing.length)throw new Error("Missing required template columns: "+missing.join(", ")+". Download the matching CSV template and keep its header names.");
      const incoming=parsed.slice(1).map((cells,index)=>{
        const record:Row={};headers.forEach((header,column)=>record[header]=cells[column]??"");
        return {record,line:index+2};
      });
      const keys=new Set<string>();
      const seenVendorNumbers=new Set<string>();
      const existing=data[importKind] as unknown as Row[];
      const categories=data.processCategories;
      const processTypes=data.processTypes;
      const vendors=data.vendors;
      const output:Prepared[]=incoming.map(({record,line})=>{
        const errors:string[]=[];
        const add=(field:string,message:string)=>{if(!String(record[field]??"").trim())errors.push(message);};
        let row:Row={};
        if(importKind==="companies"){
          add("name","Company name is required.");
          const key=norm(record.name),gstin=norm(record.gstin);
          if(existing.some(item=>norm(item.name)===key||(gstin&&norm(item.gstin)===gstin)))errors.push("Company name or GSTIN already exists.");
          const uniqueKey="company:"+key;
          if(keys.has(uniqueKey))errors.push("Duplicate company within this file.");keys.add(uniqueKey);
          row={id:makeId("company"),name:String(record.name||"").trim(),gstin:String(record.gstin||"").trim(),phone:String(record.phone||"").trim(),email:String(record.email||"").trim(),notes:String(record.notes||"").trim(),createdAt:nowIso(),updatedAt:nowIso()};
        } else if(importKind==="components"){
          add("partNumber","Part number is required.");add("name","Component name is required.");
          const part=norm(record.partNumber),revision=norm(record.revision);
          if(existing.some(item=>norm(item.partNumber)===part&&norm(item.revision)===revision))errors.push("Part number + revision already exists.");
          const key="component:"+part+"::"+revision;if(keys.has(key))errors.push("Duplicate component/revision within this file.");keys.add(key);
          row={id:makeId("component"),partNumber:String(record.partNumber||"").trim(),name:String(record.name||"").trim(),revision:String(record.revision||"").trim(),material:String(record.material||"").trim(),drawingReference:String(record.drawingReference||"").trim(),notes:String(record.notes||"").trim(),salePrice:numeric(record.salePrice,"salePrice",errors),materialQty:0,materialRate:0,benchmarkMaterialRate:0,stockQty:0,overhead:0,toolingCost:0,reworkCost:0,scrapCost:0,rejectedQty:0,gstRate:0,createdAt:nowIso(),updatedAt:nowIso()};
        } else if(importKind==="vendors"){
          add("company","Vendor company is required.");add("contact","Contact person is required.");add("processTypeId","Exactly one Process Directory processTypeId is required.");
          const process=processTypes.find(item=>item.id===String(record.processTypeId||"").trim()&&!item.deletedAt);
          if(!process)errors.push("processTypeId does not match an active Process Directory type.");
          const phone=String(record.phone||"").replace(/\D/g,""),whatsapp=String(record.whatsappNumber||"").replace(/\D/g,"");
          const numbers=[phone,whatsapp].filter(Boolean);
          if(vendors.some(item=>norm(item.company)===norm(record.company)&&norm(item.contact)===norm(record.contact)))errors.push("Vendor company/contact already exists in Vendor Master.");
          if(vendors.some(item=>numbers.some(number=>[item.phone,item.whatsappNumber].some(value=>String(value||"").replace(/\D/g,"")===number))))errors.push("Phone / WhatsApp number already belongs to an existing vendor.");
          if(numbers.some(number=>seenVendorNumbers.has(number)))errors.push("Phone / WhatsApp number is duplicated within this file.");
          numbers.forEach(number=>seenVendorNumbers.add(number));
          const key="vendor:"+norm(record.company)+"::"+norm(record.contact);
          if(keys.has(key))errors.push("Duplicate company/contact within this file.");keys.add(key);
          row={id:makeId("vendor"),company:String(record.company||"").trim(),contact:String(record.contact||"").trim(),processTypeId:process?.id||"",processes:process?.name||"",role:String(record.role||"").trim(),phone,whatsappNumber:whatsapp,email:String(record.email||"").trim(),address:String(record.address||"").trim(),machines:String(record.machines||"").trim(),materials:String(record.materials||"").trim(),notes:String(record.notes||"").trim(),status:String(record.status||"Unverified contact — review").trim(),sourceContactId:"",whatsappSyncedAt:"",createdAt:nowIso(),updatedAt:nowIso()};
        } else if(importKind==="materials"){
          add("code","Material code is required.");add("name","Material name is required.");add("unit","Unit is required.");
          const code=norm(record.code);
          if(existing.some(item=>norm(item.code)===code))errors.push("Material code already exists.");
          const key="material:"+code;if(keys.has(key))errors.push("Duplicate material code within this file.");keys.add(key);
          const preferred=String(record.preferredVendorId||"").trim();
          if(preferred&&!vendors.some(item=>item.id===preferred&&!item.deletedAt))errors.push("preferredVendorId is not an active Vendor Master ID.");
          row={id:makeId("material"),code:String(record.code||"").trim(),name:String(record.name||"").trim(),grade:String(record.grade||"").trim(),unit:String(record.unit||"").trim(),specification:String(record.specification||"").trim(),preferredVendorId:preferred,ratePerUnit:numeric(record.ratePerUnit,"ratePerUnit",errors),notes:String(record.notes||"").trim(),createdAt:nowIso(),updatedAt:nowIso()};
        } else if(importKind==="processCategories"){
          add("name","Process category name is required.");
          const keyValue=norm(record.name);
          if(existing.some(item=>norm(item.name)===keyValue))errors.push("Process category name already exists.");
          const key="category:"+keyValue;if(keys.has(key))errors.push("Duplicate process category within this file.");keys.add(key);
          row={id:makeId("process-category"),name:String(record.name||"").trim(),code:String(record.code||"").trim(),description:String(record.description||"").trim(),sortOrder:categories.length+1+line,createdAt:nowIso(),updatedAt:nowIso()};
        } else {
          add("categoryId","Process category ID is required.");add("name","Process type name is required.");
          const category=categories.find(item=>item.id===String(record.categoryId||"").trim()&&!item.deletedAt);
          if(!category)errors.push("categoryId does not match an active Process Directory category.");
          const key="processType:"+String(record.categoryId||"").trim()+"::"+norm(record.name);
          if(existing.some(item=>item.categoryId===record.categoryId&&norm(item.name)===norm(record.name)))errors.push("Process type already exists under this category.");
          if(keys.has(key))errors.push("Duplicate process type within this file.");keys.add(key);
          row={id:makeId("process-type"),categoryId:category?.id||"",name:String(record.name||"").trim(),code:String(record.code||"").trim(),description:String(record.description||"").trim(),createdAt:nowIso(),updatedAt:nowIso()};
        }
        return {line,record:row,errors};
      });
      setPrepared(output);
      onNotice("CSV read complete. Review every valid and rejected row before committing.");
    }catch(error){setFileError(error instanceof Error?error.message:"Could not read CSV file.");}
    finally{setBusy(false);}
  };
  const clearImport=()=>{setPrepared([]);setFileName("");setFileError("");};
  const commitImport=()=>{
    const accepted=prepared.filter(row=>row.errors.length===0);
    if(!accepted.length){onNotice("There are no valid rows to import.");return;}
    if(!window.confirm("Import "+accepted.length+" new "+template.label.toLowerCase()+" record(s)? Existing records will not be overwritten."))return;
    const records=accepted.map(row=>row.record);
    update(current=>{
      if(importKind==="companies")return {...current,companies:[...current.companies,...records as unknown as CompanyRecord[]]};
      if(importKind==="components")return {...current,components:[...current.components,...records as unknown as ComponentRecord[]]};
      if(importKind==="vendors")return {...current,vendors:[...current.vendors,...records as unknown as VendorRecord[]]};
      if(importKind==="materials")return {...current,materials:[...current.materials,...records as unknown as MaterialRecord[]]};
      if(importKind==="processCategories")return {...current,processCategories:[...current.processCategories,...records as unknown as ProcessCategoryRecord[]]};
      return {...current,processTypes:[...current.processTypes,...records as unknown as ProcessTypeRecord[]]};
    });
    setPrepared([]);setFileName("");setFileError("");
    onNotice(accepted.length+" new "+template.label.toLowerCase()+" record(s) added. Existing business records were not overwritten.");
  };
  const validCount=prepared.filter(row=>row.errors.length===0).length;
  const invalidCount=prepared.length-validCount;
  const templateDownload=()=>download("aximach-"+importKind+"-template.csv",csvTemplate(template.headers),"text/csv;charset=utf-8",template.label+" CSV template ready.");

  return <section className={"workspace-page module-functional-page data-exchange-workspace "+(mode==="export"?"data-exchange-export":"data-exchange-import")}>
    {notice&&<div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={()=>onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command Centre</button><span className={"demo-pill "+(syncStatus==="synced"?"scheduler-connected":"")}><i/>{syncStatus==="synced"?"SHARED SERVER DATA":syncStatus==="error"?"SYNC ERROR · LOCAL DATA KEPT":syncStatus==="syncing"?"SYNCING":"LOCAL DATA"}</span></div>
    {mode==="export"?<>
      <div className="workspace-title-row"><div><div className="eyebrow">DATA & GOVERNANCE / CONTROLLED OUTPUT</div><h1>Export Centre<span>.</span></h1><p>Preview and export real saved AXIMACH records. Filters apply before CSV, JSON or print output.</p></div><div className="workspace-title-actions"><button className="button-primary" onClick={exportCsv}><Download size={15}/> Export CSV</button><button className="button-quiet" onClick={exportExcel}><FileDown size={15}/> Export Excel</button><button className="button-quiet" onClick={exportJson}><FileDown size={15}/> Export JSON</button><button className="button-quiet" onClick={printPreview}><Printer size={15}/> Print / Save PDF</button></div></div>
      <section className="surface-panel quality-selection-panel"><div className="panel-heading"><div><h3>Choose saved source data</h3><p>{sourceMeta.label} · {allRows.length} active saved rows before filters.</p></div><span className="module-number">{exportRows.length} PREVIEW ROWS</span></div>
        <div className="quality-selectors"><label>Source dataset<select value={source} onChange={event=>setSource(event.target.value as DataKey)}>{exportSources.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label>Search values<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search within source records…"/></label><label>From date<input type="date" value={dateFrom} onChange={event=>setDateFrom(event.target.value)}/></label><label>To date<input type="date" value={dateTo} onChange={event=>setDateTo(event.target.value)}/></label></div>
      </section>
      <section className="surface-panel module-records-panel"><div className="panel-heading"><div><h3>Export preview</h3><p>Nested arrays/objects are preserved as JSON cells in CSV and as structured values in JSON.</p></div></div>
        {exportRows.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr>{Object.keys(exportRows[0]).slice(0,10).map(key=><th key={key}>{key}</th>)}</tr></thead><tbody>{exportRows.slice(0,50).map((row,index)=><tr key={String(row.id||index)}>{Object.keys(exportRows[0]).slice(0,10).map(key=><td key={key}>{typeof row[key]==="object"?JSON.stringify(row[key]):String(row[key]??"")}</td>)}</tr>)}</tbody></table></div>:<div className="module-empty-state"><Package size={24}/><h3>No matching records</h3><p>Change the source or filters. No example records are generated.</p></div>}
        <div className="export-print-table"><table className="costing-table"><thead><tr>{Object.keys(exportRows[0]||{}).map(key=><th key={key}>{key}</th>)}</tr></thead><tbody>{exportRows.map((row,index)=><tr key={String(row.id||index)}>{Object.keys(exportRows[0]||{}).map(key=><td key={key}>{typeof row[key]==="object"?JSON.stringify(row[key]):String(row[key]??"")}</td>)}</tr>)}</tbody></table></div>
        <div className="module-safety-note"><ShieldCheck size={14}/><span>Access control is not yet connected to a user/role identity system. Treat this export function as workspace-owner use on a trusted device; exported Vendor/Company and transaction data can contain business contact and financial information.</span></div>
      </section>
    </>:<>
      <div className="workspace-title-row"><div><div className="eyebrow">DATA & GOVERNANCE / VALIDATE BEFORE WRITE</div><h1>Import Data<span>.</span></h1><p>Upload a CSV template or Excel .xlsx/.xlsm workbook, validate business keys and references, preview row-level results, then explicitly commit only new valid master records.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={templateDownload}><Download size={15}/> Download CSV template</button></div></div>
      <section className="surface-panel quality-selection-panel"><div className="panel-heading"><div><h3>Select import template</h3><p>Imports append new master records only. Existing records are never overwritten.</p></div><span className="module-number">{validCount} VALID · {invalidCount} REJECTED</span></div>
        <div className="quality-selectors"><label>Master data type<select value={importKind} onChange={event=>{setImportKind(event.target.value as ImportKind);clearImport();}}>{templates.map(item=><option key={item.kind} value={item.kind}>{item.label}</option>)}</select></label><div><strong>Business key: {template.key}</strong><p>{template.description}</p><p>Required columns: {template.headers.join(", ")}</p></div><label>CSV / Excel file<input type="file" accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={event=>void prepareFile(event.target.files?.[0])}/></label></div>
        {fileName&&<p className="module-number">FILE: {fileName}</p>}{fileError&&<p className="movement-discrepancy">{fileError}</p>}
      </section>
      {prepared.length>0&&<section className="surface-panel module-records-panel"><div className="panel-heading"><div><h3>Row validation preview</h3><p>{prepared.length} rows read · {validCount} can be added · {invalidCount} will be rejected.</p></div><div className="workspace-title-actions"><button className="button-primary" disabled={!validCount||busy} onClick={commitImport}><Check size={14}/> Commit {validCount} valid rows</button><button className="button-quiet" onClick={clearImport}><X size={14}/> Clear</button></div></div>
        <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>CSV row</th><th>Record preview</th><th>Validation</th></tr></thead><tbody>{prepared.map(row=><tr key={row.line}><td>{row.line}</td><td>{String(row.record.name||row.record.partNumber||row.record.company||row.record.code||row.record.categoryId||"")}</td><td>{row.errors.length?<span className="record-state state-pending">{row.errors.join(" ")}</span>:<span className="record-state state-complete">Ready · new record</span>}</td></tr>)}</tbody></table></div>
      </section>}
      <section className="surface-panel module-safety-note"><ShieldCheck size={14}/><span>Imports currently support Companies, Components, Vendors, Materials, Process Categories and Process Types. PO, operations, inventory and other transactional collections are not imported from CSV because their cross-record, stock and custody dependencies require a dedicated reconciler. Vendor import requires one active processTypeId; duplicates are rejected, never merged silently.</span></section>
    </>}
  </section>;
}
