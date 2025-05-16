import { logInstructionDiscriminators } from "@/lib/webhooks/heliusWebhook";
import { IDL as BondingCurveIDL } from "@/utils/idl";
import crypto from "crypto";

// Calculate discriminators for verification
function calculateDiscriminator(instructionName: string): string {
  const preimage = `global:${instructionName}`;
  const hash = crypto.createHash("sha256").update(preimage).digest();
  return hash.slice(0, 8).toString("hex");
}

BondingCurveIDL.instructions.forEach((instruction) => {
  const discriminator = calculateDiscriminator(instruction.name);
  console.log(`${instruction.name}: ${discriminator}`);
});

const testSecret = "test-secret";
const testPayload = '{"test": "data"}';
const hmac = crypto.createHmac("sha256", testSecret);
hmac.update(testPayload);

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
