import type { NextApiRequest, NextApiResponse } from "next";
import { File, IncomingForm } from "formidable";
import fs from "fs";
import pdf from "pdf-parse";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  api: {
    bodyParser: false, // Required for file uploads
  },
};

interface Fields {
  fullName: string;
  address: string;
  rent: string;
  startDate: string;
  endDate: string;
}
// Case-insensitive contains
const fuzzyIncludes = (a: string, b: string) =>
  a.toLowerCase().includes(b.toLowerCase().trim());

const getField = (f: any) => (Array.isArray(f) ? f[0] : f);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const form = new IncomingForm({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Form parsing failed", detail: err });
    }

    console.log("FILES", files);
    console.log("Fields", fields);

    try {
      // Formidable gives us each field as an array of values, so they need to be unwrapped.
      const fullName = getField(fields.fullName);
      const address = getField(fields.address);
      const rent = getField(fields.rent);
      const startDate = getField(fields.startDate);
      const endDate = getField(fields.endDate);

      console.log("fullname", fullName[0]);
      console.log("address", address);
      console.log("rent", rent);
      console.log("startDate", startDate);
      console.log("endDate", endDate);

      const file = Array.isArray(files.pdfFile)
        ? files.pdfFile[0]
        : files.pdfFile;
      if (!file?.filepath) {
        return res.status(400).json({ error: "No valid PDF file uploaded" });
      }

      const dataBuffer = fs.readFileSync(file.filepath);
      const data = await pdf(dataBuffer);
      const text = data.text.toLowerCase(); // normalize case for easier matching

      // Send raw text to OpenAI for extraction
      const prompt = `
You are a tenancy agreement parser. Extract structured data in JSON format from the text below.

Output JSON should follow this schema:
{
  "tenants": [{ "fullName": "..." }],
  "property": { "address": "..." },
  "rent": {
    "amount": number,
    "currency": "GBP",
    "dueDay": number,
    "frequency": "monthly",
    "paymentDetails": {
      "accountName": "...",
      "sortCode": "...",
      "accountNumber": "...",
      "paymentReference": "..."
    }
  },
  "tenancy": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "durationMonths": number
  },
  "deposit": {
    "amount": number,
    "currency": "GBP",
    "protectedBy": "..."
  },
  "landlord": {
    "name": "...",
    "agent": {
      "name": "...",
      "address": "..."
    }
  }
}

DO NOT output anything other than the JSON. Do not wrap the JSON output in \`\`\`json\`\`\`.

Text:
"""${text}"""
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt },
        ],
      });

      const message = completion.choices[0].message.content || "";

      console.log(message);
      const extracted = JSON.parse(message);

      console.log("EXTRACTED", extracted);

      // Basic match checks (fuzzy: lowercase & trim)
      // const match = {
      //   fullName: text.includes(fullName.trim().toLowerCase()),
      //   address: text.includes(address.trim().toLowerCase()),
      //   rent: text.includes(rent.trim()),
      //   startDate: text.includes(startDate.trim()),
      //   endDate: text.includes(endDate.trim()),
      // };

      // 💰 Deposit regex
      // const depositMatch = text.match(
      //   /deposit[^£$]*[£$]?\s?(\d+(?:,\d{3})*(?:\.\d{2})?)/i
      // );
      // const extractedDeposit = depositMatch?.[1] ?? null;

      // const issues = Object.entries(match)
      //   .filter(([_, isMatch]) => !isMatch)
      //   .map(([key]) => `Mismatch on ${key}`);

      // if (!extractedDeposit) {
      //   issues.push("Could not extract deposit amount from document");
      // }

      // Step 3: Matching logic
      const match = {
        fullName:
          extracted.tenants?.some((t: any) =>
            fuzzyIncludes(t.fullName, fullName)
          ) || false,
        address: fuzzyIncludes(extracted.property?.address || "", address),
        rent: extracted.rent?.amount === parseFloat(rent),
        startDate: extracted.tenancy?.startDate === startDate,
        endDate: extracted.tenancy?.endDate === endDate,
      };

      const issues = Object.entries(match)
        .filter(([_, isMatch]) => !isMatch)
        .map(([key]) => `Mismatch on ${key}`);

      console.log("\n🔍 Field Comparison:");
      console.log("-----------------------------");
      console.log("User Full Name:", fullName);
      console.log(
        "Extracted Full Names:",
        extracted.tenants?.map((t: any) => t.fullName).join(" | ")
      );
      console.log("Match:", match.fullName ? "✅" : "❌");

      console.log("\nUser Address:", address);
      console.log("Extracted Address:", extracted.property?.address);
      console.log("Match:", match.address ? "✅" : "❌");

      console.log("\nUser Rent:", rent);
      console.log("Extracted Rent:", extracted.rent?.amount);
      console.log("Match:", match.rent ? "✅" : "❌");

      console.log("\nUser Start Date:", startDate);
      console.log("Extracted Start Date:", extracted.tenancy?.startDate);
      console.log("Match:", match.startDate ? "✅" : "❌");

      console.log("\nUser End Date:", endDate);
      console.log("Extracted End Date:", extracted.tenancy?.endDate);
      console.log("Match:", match.endDate ? "✅" : "❌");

      console.log(
        "\n🧾 Issues:",
        issues.length ? issues.join(", ") : "None — all fields matched ✅"
      );

      return res.status(200).json({
        extracted,
        match,
        issues,
        success: issues.length === 0,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Processing error", detail: (error as Error).message });
    }
  });
}
