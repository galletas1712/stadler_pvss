import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { BITS, H, P, Q } from "./constants";
import { bigNumModExp } from "./util";

const COMMITTEE_SIZE = 10;

describe("PVSS", () => {
  let signers: SignerWithAddress[];
  let committee: SignerWithAddress[];
  let secretKeys: BigNumber[];
  let publicKeys: BigNumber[];
  let PVSSContract: Contract;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    committee = signers.slice(1, COMMITTEE_SIZE + 1);
    PVSSContract = await (
      await ethers.getContractFactory("PVSS")
    ).deploy(committee.map((signer) => signer.address));
    secretKeys = committee.map(() =>
      BigNumber.from(ethers.utils.randomBytes(BITS / 8)).mod(Q)
    );
    publicKeys = secretKeys.map((sk) =>
      bigNumModExp(
        BigNumber.from(H.toString()),
        sk,
        BigNumber.from(P.toString())
      )
    );
  });

  it("Should correctly instantiate addresses corresponding to committee", async () => {
    for (let i = 0; i < committee.length; i++) {
      expect(await PVSSContract.committeeAddresses(i)).to.equal(
        committee[i].address
      );
      expect(await PVSSContract.committeePKs(committee[i].address)).to.equal(0);
      expect(
        await PVSSContract.committeeHasAddress(committee[i].address)
      ).to.equal(true);
      expect(
        await PVSSContract.committeeMemberSetPK(committee[i].address)
      ).to.equal(false);
    }
    expect(await PVSSContract.remainingPKsToSet()).to.equal(committee.length);
  });

  it("Should only accept public keys from committee", async () => {
    // Add public key from non-committee
    await expect(
      PVSSContract.connect(signers[COMMITTEE_SIZE + 1]).sharePK(
        BigNumber.from(ethers.utils.randomBytes(BITS / 8)).mod(P)
      )
    ).to.be.revertedWith("msg.sender does not belong to committee");
    // Add public keys from committee
    for (let i = 0; i < committee.length; i++) {
      // Share bogus PK first
      const bogusPK = ethers.utils.randomBytes(BITS / 8);
      await (await PVSSContract.connect(committee[i]).sharePK(bogusPK)).wait();
      expect(await PVSSContract.remainingPKsToSet()).to.equal(
        committee.length - i - 1
      );
      expect(
        await PVSSContract.committeeMemberSetPK(committee[i].address)
      ).to.equal(true);
      expect(await PVSSContract.committeePKs(committee[i].address)).to.equal(
        bogusPK
      );

      // Share actual PK
      await (
        await PVSSContract.connect(committee[i]).sharePK(publicKeys[i])
      ).wait();
      expect(await PVSSContract.remainingPKsToSet()).to.equal(
        committee.length - i - 1
      );
      expect(
        await PVSSContract.committeeMemberSetPK(committee[i].address)
      ).to.equal(true);
      expect(await PVSSContract.committeePKs(committee[i].address)).to.equal(
        publicKeys[i]
      );
    }
  });
});
