import { BigNumber } from "ethers";

export const bigNumModExp = (
  base: BigNumber,
  exp: BigNumber,
  mod: BigNumber
): BigNumber => {
  if (exp.eq(BigNumber.from(0))) {
    return BigNumber.from(1);
  }
  if (exp.eq(BigNumber.from(1))) {
    return base;
  }
  return bigNumModExp(base.mul(base).mod(mod), exp.div(2), mod)
    .mul(bigNumModExp(base, exp.and(1), mod))
    .mod(mod);
};
