import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { BITS, Q, H, P } from "./constants";
import { modExp, UInt8ToBigInt } from "./util";

export const instantiateContract = async (
  committee: SignerWithAddress[]
): Promise<[Contract, bigint[], bigint[]]> => {
  const PVSSContract = await (
    await ethers.getContractFactory("PVSS")
  ).deploy(committee.map((signer) => signer.address));
  const secretKeys = committee.map(
    () => UInt8ToBigInt(ethers.utils.randomBytes(BITS / 8)) % Q
  );
  const publicKeys = secretKeys.map((sk) => modExp(H, sk, P));
  return [PVSSContract, secretKeys, publicKeys];
};

export const shareKeys = async (
  PVSSContract: Contract,
  committee: SignerWithAddress[],
  publicKeys: bigint[]
) =>
  Promise.all(
    committee.map(async (member, i) =>
      (await PVSSContract.connect(member).sharePK(publicKeys[i])).wait()
    )
  );
