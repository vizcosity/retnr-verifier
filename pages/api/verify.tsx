import type { NextApiRequest, NextApiResponse } from "next";
import { File, IncomingForm } from "formidable";
import fs from "fs";
import pdf from "pdf-parse";

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

      // const file =
      //   (files.pdfFile as File) ||
      //   (Array.isArray(files.pdfFile) && files.pdfFile[0]);
      // if (!file) return res.status(400).json({ error: "No PDF file provided" });

      const file = Array.isArray(files.pdfFile)
        ? files.pdfFile[0]
        : files.pdfFile;
      if (!file?.filepath) {
        return res.status(400).json({ error: "No valid PDF file uploaded" });
      }

      const dataBuffer = fs.readFileSync(file.filepath);
      const data = await pdf(dataBuffer);
      const text = data.text.toLowerCase(); // normalize case for easier matching

      // console.log("text", text);

      // Basic match checks (fuzzy: lowercase & trim)
      const match = {
        fullName: text.includes(fullName.trim().toLowerCase()),
        address: text.includes(address.trim().toLowerCase()),
        rent: text.includes(rent.trim()),
        startDate: text.includes(startDate.trim()),
        endDate: text.includes(endDate.trim()),
      };

      // 💰 Deposit regex
      const depositMatch = text.match(
        /deposit[^£$]*[£$]?\s?(\d+(?:,\d{3})*(?:\.\d{2})?)/i
      );
      const extractedDeposit = depositMatch?.[1] ?? null;

      const issues = Object.entries(match)
        .filter(([_, isMatch]) => !isMatch)
        .map(([key]) => `Mismatch on ${key}`);

      if (!extractedDeposit) {
        issues.push("Could not extract deposit amount from document");
      }

      return res.status(200).json({
        match,
        extractedDeposit,
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
