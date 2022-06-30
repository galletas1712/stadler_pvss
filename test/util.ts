import { BigNumber } from "ethers";

export const bigNumModExp = (base: BigNumber, exp: BigNumber, mod: BigNumber) =>
  BigNumber.from(
    modExp(
      BigInt(base.toString()),
      BigInt(exp.toString()),
      BigInt(mod.toString())
    ).toString()
  );

const modExp = (base: bigint, exp: bigint, mod: bigint): bigint => {
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
