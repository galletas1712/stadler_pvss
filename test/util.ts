import { Bytes } from "ethers";
import { ethers } from "hardhat";

export const UInt8ToBigInt = (x: Uint8Array): bigint => BigInt("0x" + Buffer.from(x).toString('hex'));
export const BigIntToHex = (x: bigint): string => {
  const stripped = x.toString(16);
  return "0x" + (stripped.length % 2 == 1 ? "0" : "") + stripped;
};
export const BigIntToBytes = (x: bigint): Bytes => ethers.utils.arrayify(BigIntToHex(x));

export const modExp = (base: bigint, exp: bigint, mod: bigint): bigint => {
  if (exp === 0n) {
    return 1n;
  }
  if (exp === 1n) {
    return base;
  }
  return (
    (modExp((base * base) % mod, exp / 2n, mod) * modExp(base, exp & 1n, mod)) %
    mod
  );
};
