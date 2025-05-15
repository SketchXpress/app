import { logInstructionDiscriminators } from "@/lib/webhooks/heliusWebhook";
import { IDL as BondingCurveIDL } from "@/utils/idl";
import crypto from "crypto";

// Calculate discriminators for verification
function calculateDiscriminator(instructionName: string): string {
  const preimage = `global:${instructionName}`;
  const hash = crypto.createHash("sha256").update(preimage).digest();
  return hash.slice(0, 8).toString("hex");
}

console.log("=== Bonding Curve Program Debug ===");
console.log("Program ID:", process.env.BONDING_CURVE_PROGRAM_ID);
console.log(
  "IDL Instructions:",
  BondingCurveIDL.instructions.map((i) => i.name)
);

console.log("\n=== Calculated Discriminators ===");
BondingCurveIDL.instructions.forEach((instruction) => {
  const discriminator = calculateDiscriminator(instruction.name);
  console.log(`${instruction.name}: ${discriminator}`);
});

console.log("\n=== Test Webhook Signature ===");
const testSecret = "test-secret";
const testPayload = '{"test": "data"}';
const hmac = crypto.createHmac("sha256", testSecret);
hmac.update(testPayload);
const signature = `sha256=${hmac.digest("hex")}`;
console.log("Test payload:", testPayload);
console.log("Test signature:", signature);

// Function to test discriminator matching
export function testDiscriminatorMatch(
  instructionData: string,
  expectedInstruction: string
) {
  try {
    const data = Buffer.from(instructionData, "base64");
    const discriminator = data.slice(0, 8);
    const expectedDiscriminator = Buffer.from(
      calculateDiscriminator(expectedInstruction),
      "hex"
    );

    console.log(`\n=== Testing ${expectedInstruction} ===`);
    console.log("Instruction data length:", data.length);
    console.log("Extracted discriminator:", discriminator.toString("hex"));
    console.log(
      "Expected discriminator:",
      expectedDiscriminator.toString("hex")
    );
    console.log("Match:", discriminator.equals(expectedDiscriminator));

    return discriminator.equals(expectedDiscriminator);
  } catch (error) {
    console.error("Error testing discriminator:", error);
    return false;
  }
}

// Run debug info
if (require.main === module) {
  logInstructionDiscriminators();
}
