const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config();
const nodemailer = require("nodemailer");
const { spawn } = require("child_process");
const fs = require("fs").promises;
const cron = require("node-cron");
const sharp = require("sharp");


const app = express();
app.use(express.json());

const GHL_API_KEY = process.env.GHL_API_KEY;
const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_BASE_URL_V1 = "https://api.pipedrive.com/v1";
const PIPEDRIVE_BASE_URL_V2 = "https://api.pipedrive.com/v2";

const ghlApi = axios.create({
  baseURL: "https://services.leadconnectorhq.com",
  headers: {
    Authorization: `Bearer ${GHL_API_KEY}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
  },
});

app.post("/webhook/opportunity", async (req, res) => {
  try {
    const { contactId } = req.query;
    if (!contactId) return res.status(400).json({ error: "contactId is required" });
    
    const contactRes = await ghlApi.get(`/contacts/${contactId}`);
    const contact = contactRes.data.contact;
    const { locationId, email, phone, firstName, lastName } = contact;
    
    const convRes = await ghlApi.get(`/conversations/search?locationId=${locationId}&contactId=${contactId}`);
    const conversations = convRes.data.conversations;
    const lastConv = conversations[0];
    const conversationId = lastConv.id;

    const messagesRes = await ghlApi.get(`/conversations/${conversationId}/messages`);
    const messages = messagesRes.data.messages;
    const lastCall = messages['messages'].find((m) => m.messageType === "TYPE_CALL");
    const messageId = lastCall.id;

    const audioRes = await ghlApi.get(
      `/conversations/messages/${messageId}/locations/${locationId}/recording`,
      { responseType: "arraybuffer" }
    );
    const audioBuffer = audioRes.data;

    const notesRes = await ghlApi.get(`/contacts/${contactId}/notes`);
    const notes = notesRes.data.notes.map((n) => n.body).join("\n");
    const htmlNotes = notes
    .split("\n")
    .map(line => `<p>${line}</p>`)
    .join("");
 
 
    const person = await ghlApi.get(`https://highcrestarchitecturalproducts.pipedrive.com/api/v1/persons/search?api_token=${PIPEDRIVE_API_KEY}&term=${firstName} ${lastName}`);
    let personId = null;
    if (person.data.data.items.length > 0) {
      personId = person.data.data.items[0].item.id;
    } else {
      const personRes = await axios.post(
        `${PIPEDRIVE_BASE_URL_V2}/persons?api_token=${PIPEDRIVE_API_KEY}`,
        {
          name: `${firstName} ${lastName}`,
          emails: email,
          phones: phone,
        }
      );
      personId = personRes.data.data.id;
    }

    const leadRes = await axios.post(
      `${PIPEDRIVE_BASE_URL_V1}/leads?api_token=${PIPEDRIVE_API_KEY}`,
      {
        title: `Lead from GHL - ${firstName} ${lastName}`,
        person_id: personId,
      }
    );
    const leadId = leadRes.data.data.id;
    

    await axios.post(
      `${PIPEDRIVE_BASE_URL_V1}/notes?api_token=${PIPEDRIVE_API_KEY}`,
      { content: htmlNotes, lead_id: leadId }
    );

    let form = new FormData();
    form.append("file", audioBuffer, { filename: "call_recording.mp3" });
    form.append("lead_id", leadId);

    await axios.post(
      `${PIPEDRIVE_BASE_URL_V1}/files?api_token=${PIPEDRIVE_API_KEY}`,
      form,
      { headers: form.getHeaders() }
    );

    const deal = await axios.post(
      `${PIPEDRIVE_BASE_URL_V2.replace("v2", "api/v2/deals")}?api_token=${PIPEDRIVE_API_KEY}`,
      {
        title: `Deal from GHL - ${firstName} ${lastName}`,
        stage_id: 18,
        person_id: personId,
      }
    );
    const dealId = deal.data.data.id;
    
    await axios.post(
      `${PIPEDRIVE_BASE_URL_V1}/notes?api_token=${PIPEDRIVE_API_KEY}`,
      { content: htmlNotes, deal_id: dealId }
    );

    form = new FormData();
    form.append("file", audioBuffer, { filename: "call_recording.mp3" });
    form.append("deal_id", dealId); 
    await axios.post(
      `${PIPEDRIVE_BASE_URL_V1}/files?api_token=${PIPEDRIVE_API_KEY}`,
      form,
      { headers: form.getHeaders() }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Error processing lead" });
  }
});


// async function runSelenium() {
//   return new Promise((resolve, reject) => {
//     const py = spawn("python", ["./scripts/reporting.py"]);

//     py.stdout.on("data", (data) => console.log(`PYTHON STDOUT: ${data}`));
//     py.stderr.on("data", (data) => console.error(`PYTHON STDERR: ${data}`));

//     py.on("close", (code) => {
//       if (code === 0) {
//         console.log("✅ Report generated");
//         resolve();
//       } else {
//         reject("Error executing Selenium");
//       }
//     });
//   });
// }


// async function sendReport() {
//   try {
//     if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
//       throw new Error(
//         "SMTP credentials not found. Make sure SMTP_USER and SMTP_PASS are defined in your .env file"
//       );
//     }

//     const statsRaw = await fs.readFile("./reports/callingStats.txt", "utf-8");
//     const statsLines = statsRaw.trim().split('\n');
//     const statsHtml = statsLines.map(line => `<p style="margin: 0 15px; font-size: 16px; color: #333;">${line.replace(":", ": ")}</p>`).join('');

//     const funnelPngBuffer = await sharp("./reports/funnel.svg").png().toBuffer();

//     const htmlBody = `
//       <body style="background-color: #ffffff; font-family: Arial, sans-serif; text-align: center; margin: 0; padding: 20px;">
//         <h1 style="color: #333; margin-bottom: 40px;">Weekly Report</h1>
        
//         <div style="margin-bottom: 50px;">
//           <h2 style="color: #444;">Calling Report</h2>
//           <div style="display: inline-flex; justify-content: center; align-items: center; margin-bottom: 30px; padding: 20px; background-color: #f8f8f8; border-radius: 8px;">
//             ${statsHtml}
//           </div>
//           <img src="cid:callingReportImage" alt="Calling Report" style="max-width: 90%; height: auto; border: 1px solid #ddd; border-radius: 8px; display: block; margin: 0 auto;"/>
//         </div>

//         <div>
//           <h2 style="color: #444;">Funnel General Contractors</h2>
//           <img src="cid:funnelImage" alt="Funnel" style="max-width: 90%; height: auto; border: 1px solid #ddd; border-radius: 8px; display: block; margin: 0 auto;"/>
//         </div>
//       </body>
//     `;

//     let transporter = nodemailer.createTransport({
//       host: "smtp.gmail.com",
//       port: 465,
//       secure: true,
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });

//     await transporter.sendMail({
//       from: '"Automatic Report" <pistolesilucas@gmail.com>',
//       to: "daryl@n-hanceconsulting.com",
//       subject: "📊 Weekly Report",
//       html: htmlBody,
//       attachments: [
//         { filename: "callingReport.png", path: "./reports/callingReport.png", cid: "callingReportImage" },
//         { filename: "funnel.png", content: funnelPngBuffer, cid: "funnelImage" },
//       ],
//     });

//     console.log("📨 Email sent successfully");
//   } catch (error) {
//     console.error("Error sending report:", error);
//   }
// }

// cron.schedule("00 18 * * 5", async () => {
//   console.log("⏰ Running weekly report...");
//   await runSelenium();
//   await sendReport();
// });

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`App running on ${port}`));
}

app.get("/ping", (req, res) => res.json({ status: "ok" }));


module.exports = app; 
