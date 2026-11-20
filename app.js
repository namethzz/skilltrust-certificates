import { deployment } from "./config.js";

const $ = (id) => document.getElementById(id);
const ethers = globalThis.ethers;
const abi = [
  "function admin() view returns (address)",
  "function issuers(address) view returns (bool)",
  "function courses(string) view returns (string title, string description)",
  "function certificates(string) view returns (string courseCode, address recipient, address issuer, bytes32 documentHash, uint64 issuedAt, uint64 revokedAt)",
  "function certificateCount(address) view returns (uint256)",
  "function certificateCodeAt(address,uint256) view returns (string)",
  "function createCourse(string,string,string)",
  "function issueCertificate(string,string,address,bytes32)",
  "function revokeCertificate(string)",
  "function setIssuer(address,bool)"
];

const chainHex = "0x" + deployment.chainId.toString(16);
const ethereum = window.ethereum?.providers?.find((provider) => provider.isMetaMask)
  ?? (window.ethereum?.isMetaMask ? window.ethereum : null);
const pageSize = 8;
let account = null;
let walletHidden = false;
let page = 0;
let walletRevision = 0;
let verificationRevision = 0;
let pendingWrite = false;
let readerPromise;

$("network").textContent = deployment.network;

function notice(message, failed = false) {
  $("notice").textContent = message;
  $("notice").hidden = !message;
  $("notice").classList.toggle("error", failed);
}

function errorMessage(error) {
  if (error.code === 4001 || error.code === "ACTION_REJECTED") return "ยกเลิกรายการใน MetaMask";
  return error.reason || error.shortMessage || error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

function address(value) {
  if (!ethers) throw new Error("โหลดไลบรารี Ethereum ไม่สำเร็จ กรุณารีเฟรช");
  const result = ethers.getAddress(value.trim());
  if (result === ethers.ZeroAddress) throw new Error("กรุณาระบุ Wallet ที่ใช้งานได้");
  return result;
}

function reference(value) {
  const result = value.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,32}$/.test(result)) throw new Error("รหัสต้องมี 1–32 ตัว ใช้ A–Z, 0–9 หรือขีดกลาง");
  return result;
}

async function pdfHash(file) {
  if (!file?.size || await file.slice(0, 5).text() !== "%PDF-") throw new Error("กรุณาเลือกไฟล์ PDF ที่ถูกต้อง");
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return ethers.hexlify(new Uint8Array(hash));
}

async function openReader() {
  const contractAddress = address(deployment.address);
  const network = ethers.Network.from(deployment.chainId);
  const providers = deployment.rpc.map((url) => {
    const request = new ethers.FetchRequest(url);
    request.timeout = 7000;
    return new ethers.JsonRpcProvider(request, network);
  });
  if (ethereum && await ethereum.request({method: "eth_chainId"}).catch(() => null) === chainHex) {
    providers.push(new ethers.BrowserProvider(ethereum, network));
  }
  return Promise.any(providers.map(async (provider) => {
    if (await provider.getCode(contractAddress) === "0x") throw new Error("Contract not found");
    return new ethers.Contract(contractAddress, abi, provider);
  })).catch(() => { throw new Error("เชื่อมต่อ Contract บน " + deployment.network + " ไม่สำเร็จ"); });
}

function reader() {
  if (!deployment.address) throw new Error("ยังไม่ได้ตั้งค่า Contract Address ของเว็บไซต์");
  readerPromise ??= openReader().catch((error) => {
    readerPromise = undefined;
    throw error;
  });
  return readerPromise;
}

function selectPanel(panel) {
  for (const button of document.querySelectorAll("[data-panel]")) {
    const active = button.dataset.panel === panel;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
    $(button.dataset.panel).hidden = !active;
  }
  if (panel === "dashboard") void loadHistory();
}

function record(code, certificate, course, matches = null) {
  const revoked = certificate.revokedAt > 0n;
  const card = document.createElement("article");
  card.className = "record";
  const status = document.createElement("span");
  status.className = revoked ? "badge bad" : "badge";
  status.textContent = revoked ? "เพิกถอนแล้ว" : "ยังมีผล";
  const heading = document.createElement("h3");
  heading.textContent = code;
  card.append(status, heading);
  const date = (seconds) => new Date(Number(seconds) * 1000).toLocaleString("th-TH", {timeZone: "Asia/Bangkok"});
  const details = [
    "หลักสูตร " + course.title + " (" + certificate.courseCode + ")",
    course.description,
    "วันที่ออก " + date(certificate.issuedAt),
    "Wallet ผู้รับ " + certificate.recipient
  ];
  if (revoked) details.push("วันที่เพิกถอน " + date(certificate.revokedAt));
  if (matches !== null) details.push(matches ? "✓ ไฟล์ PDF ตรงกับแฮชบนเชน" : "✕ ไฟล์ PDF ไม่ตรงกับแฮชบนเชน");
  for (const value of details) {
    const line = document.createElement("p");
    line.textContent = value;
    card.append(line);
  }
  const link = document.createElement("a");
  const url = new URL("./", location.href);
  url.searchParams.set("code", code);
  link.href = url.href;
  link.textContent = "ลิงก์ตรวจสอบใบรับรอง";
  card.append(link);
  return card;
}

async function verify(event) {
  event?.preventDefault();
  notice("");
  const revision = ++verificationRevision;
  const output = $("verify-result");
  output.textContent = "กำลังค้นหาบน Ethereum…";
  try {
    const code = reference($("verify-code").value);
    const file = $("verify-file").files[0];
    const contract = await reader();
    const certificate = await contract.certificates(code);
    if (revision !== verificationRevision) return;
    if (certificate.issuedAt === 0n) {
      output.textContent = "ไม่พบใบรับรองรหัส " + code;
      return;
    }
    const [course, matches] = await Promise.all([
      contract.courses(certificate.courseCode),
      file ? pdfHash(file).then((hash) => hash.toLowerCase() === certificate.documentHash.toLowerCase()) : null
    ]);
    if (revision !== verificationRevision) return;
    const card = record(code, certificate, course, matches);
    if (typeof globalThis.qrcode === "function") {
      const qr = globalThis.qrcode(0, "M");
      qr.addData(card.querySelector("a").href);
      qr.make();
      const image = document.createElement("img");
      image.src = qr.createDataURL(4, 16);
      image.alt = "QR Code สำหรับเปิดผลตรวจใบรับรอง " + code;
      card.append(image);
    }
    output.replaceChildren(card);
  } catch (error) {
    if (revision === verificationRevision) output.textContent = errorMessage(error);
  }
}

async function loadHistory() {
  const revision = walletRevision;
  const currentPage = page;
  const wallet = account;
  const output = $("history");
  $("pages").hidden = true;
  output.replaceChildren();
  if (!wallet) {
    $("history-state").textContent = "เชื่อมต่อ MetaMask เพื่อดูใบรับรองที่ผูกกับกระเป๋าของคุณ";
    return;
  }
  $("history-state").textContent = "กำลังอ่านประวัติ…";
  try {
    const contract = await reader();
    const count = await contract.certificateCount(wallet);
    const offset = BigInt(currentPage * pageSize);
    const size = Number(count - offset > BigInt(pageSize) ? BigInt(pageSize) : count - offset);
    const cards = await Promise.all(Array.from({length: Math.max(0, size)}, async (_, index) => {
      const code = await contract.certificateCodeAt(wallet, count - offset - 1n - BigInt(index));
      const certificate = await contract.certificates(code);
      return record(code, certificate, await contract.courses(certificate.courseCode));
    }));
    if (revision !== walletRevision || currentPage !== page) return;
    $("history-state").textContent = count ? "ใบรับรองทั้งหมด " + count + " รายการ" : "กระเป๋านี้ยังไม่มีใบรับรอง";
    output.replaceChildren(...cards);
    $("pages").hidden = count <= BigInt(pageSize);
    $("previous").disabled = currentPage === 0;
    $("next").disabled = offset + BigInt(pageSize) >= count;
  } catch (error) {
    if (revision === walletRevision && currentPage === page) $("history-state").textContent = errorMessage(error);
  }
}

async function setAccount(value) {
  const revision = ++walletRevision;
  account = walletHidden ? null : value || null;
  page = 0;
  $("connect").textContent = account ? account.slice(0, 6) + "…" + account.slice(-4) + " · ตัดการเชื่อมต่อ" : "เชื่อมต่อ MetaMask";
  $("management").hidden = true;
  for (const form of document.querySelectorAll("[data-owner]")) form.hidden = true;
  $("access").textContent = account ? "กำลังตรวจสอบสิทธิ์…" : "เชื่อมต่อ MetaMask ด้วยบัญชีผู้ดูแลหรือผู้ออกใบรับรอง";
  if (!$("dashboard").hidden) void loadHistory();
  if (!account) return;
  try {
    const contract = await reader();
    const [admin, issuer] = await Promise.all([contract.admin(), contract.issuers(account)]);
    if (revision !== walletRevision) return;
    const owner = admin.toLowerCase() === account.toLowerCase();
    $("access").textContent = owner ? "สิทธิ์ผู้ดูแลระบบ" : issuer ? "สิทธิ์ผู้ออกใบรับรอง" : "บัญชีนี้ยังไม่มีสิทธิ์จัดการใบรับรอง";
    $("management").hidden = !(owner || issuer);
    for (const form of document.querySelectorAll("[data-owner]")) form.hidden = !owner;
  } catch (error) {
    if (revision === walletRevision) $("access").textContent = errorMessage(error);
  }
}

async function connect() {
  notice("");
  if (account) {
    walletHidden = true;
    await setAccount(null);
    return;
  }
  try {
    if (!ethereum) throw new Error("เปิดเว็บด้วยเบราว์เซอร์ที่ติดตั้ง MetaMask");
    walletHidden = false;
    const [wallet] = await ethereum.request({method: "eth_requestAccounts"});
    await setAccount(wallet);
  } catch (error) {
    notice(errorMessage(error), true);
  }
}

function writeForm(id, method, parameters) {
  $(id).addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pendingWrite || !account) return;
    const form = event.currentTarget;
    const wallet = account;
    const buttons = [...document.querySelectorAll("#management button")];
    pendingWrite = true;
    buttons.forEach((button) => button.disabled = true);
    try {
      const args = await parameters(new FormData(form));
      await reader();
      if (await ethereum.request({method: "eth_chainId"}) !== chainHex) {
        await ethereum.request({method: "wallet_switchEthereumChain", params: [{chainId: chainHex}]});
      }
      if (account !== wallet) throw new Error("บัญชี MetaMask เปลี่ยนแล้ว กรุณาส่งรายการใหม่");
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner(wallet);
      const contract = new ethers.Contract(address(deployment.address), abi, signer);
      notice("ตรวจสอบและยืนยันรายการใน MetaMask");
      const tx = await contract[method](...args);
      notice("รายการถูกส่งแล้ว กำลังรอการยืนยันบนเชน " + tx.hash);
      await tx.wait();
      form.reset();
      await setAccount(account);
      notice("บันทึกสำเร็จบน " + deployment.network);
    } catch (error) {
      notice(errorMessage(error), true);
    } finally {
      pendingWrite = false;
      buttons.forEach((button) => button.disabled = false);
    }
  });
}

writeForm("course-form", "createCourse", (form) => {
  const title = form.get("title").trim();
  const description = form.get("description").trim();
  if (!title || !description) throw new Error("กรอกชื่อและรายละเอียดหลักสูตรให้ครบ");
  return [reference(form.get("code")), title, description];
});
writeForm("issue-form", "issueCertificate", async (form) => [
  reference(form.get("code")), reference(form.get("course")), address(form.get("recipient")), await pdfHash(form.get("pdf"))
]);
writeForm("revoke-form", "revokeCertificate", (form) => {
  const code = reference(form.get("code"));
  if (!window.confirm("ยืนยันเพิกถอน " + code + " ถาวรหรือไม่?")) throw new Error("ยกเลิกการเพิกถอน");
  return [code];
});
writeForm("issuer-form", "setIssuer", (form) => [address(form.get("account")), form.get("allowed") === "yes"]);

$("connect").addEventListener("click", connect);
$("verify-form").addEventListener("submit", verify);
$("previous").addEventListener("click", () => { page -= 1; void loadHistory(); });
$("next").addEventListener("click", () => { page += 1; void loadHistory(); });
for (const button of document.querySelectorAll("[data-panel]")) {
  button.addEventListener("click", () => selectPanel(button.dataset.panel));
}
ethereum?.on("accountsChanged", (accounts) => void setAccount(accounts[0]));
ethereum?.on("chainChanged", () => {
  readerPromise = undefined;
  void setAccount(account);
});
if (deployment.address) {
  $("contract-link").href = deployment.explorer + "/address/" + deployment.address;
  $("contract-link").hidden = false;
} else {
  notice("เว็บไซต์พร้อมตั้งค่า รอ Contract Address บน " + deployment.network);
}
const initialCode = new URLSearchParams(location.search).get("code");
if (initialCode) {
  $("verify-code").value = initialCode;
  void verify();
}
