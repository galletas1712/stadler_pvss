import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { BITS, COMMITTEE_SIZE, P } from "./constants";
import { instantiateContract, shareKeys } from "./lib";
import { BigIntToHex, UInt8ToBigInt } from "./util";

describe("Key Sharing", () => {
  let committee: SignerWithAddress[];
  let secretKeys: bigint[];
  let publicKeys: bigint[];
  let PVSSContract: Contract;

  beforeEach(async () => {
    committee = (await ethers.getSigners()).slice(1, COMMITTEE_SIZE + 1);
    [PVSSContract, publicKeys, secretKeys] = await instantiateContract(
      committee
    );
  });

  it("Should correctly instantiate initial state", async () => {
    // Set threshold to floor(COMMITTEE_SIZE / 2) + 1
    expect(await PVSSContract.threshold()).to.equal(
      Math.floor(COMMITTEE_SIZE / 2) + 1
    );

    // Send contract into KEY_COLLECTION phase
    expect(await PVSSContract.phase()).to.equal(0);

    // Correctly instantiate addresses corresponding to committee
    for (let i = 0; i < committee.length; i++) {
      expect(await PVSSContract.committeeAddresses(i)).to.equal(
        committee[i].address
      );
      expect(
        await PVSSContract.indexOfInCommittee(committee[i].address)
      ).to.equal(i);
      expect(await PVSSContract.committeePKs(i)).to.equal(BigNumber.from(0));
      expect(
        await PVSSContract.committeeHasAddress(committee[i].address)
      ).to.equal(true);
      expect(
        await PVSSContract.committeeMemberSet(committee[i].address)
      ).to.equal(false);
    }
    expect(await PVSSContract.remainingToSet()).to.equal(committee.length);
  });

  it("Should not accept public keys from outside of the committee", async () => {
    await expect(
      PVSSContract.connect(
        (
          await ethers.getSigners()
        )[COMMITTEE_SIZE + 1]
      ).sharePK(
        BigIntToHex(UInt8ToBigInt(ethers.utils.randomBytes(BITS / 8)) % P)
      )
    ).to.be.revertedWith("msg.sender not in committee");
  });

  it("Should only allow committee members to send public keys once and change phase at the end", async () => {
    for (let i = 0; i < committee.length; i++) {
      expect(
        await PVSSContract.committeeMemberSet(committee[i].address)
      ).to.equal(false);
      expect(await PVSSContract.committeePKs(i)).to.equal(BigNumber.from(0));
      await (
        await PVSSContract.connect(committee[i]).sharePK(
          BigIntToHex(publicKeys[i])
        )
      ).wait();
      expect(await PVSSContract.committeePKs(i)).to.equal(
        BigIntToHex(publicKeys[i])
      );
      expect(
        await PVSSContract.committeeMemberSet(committee[i].address)
      ).to.equal(true);
      expect(await PVSSContract.remainingToSet()).to.equal(
        committee.length - i - 1
      );
      await expect(
        PVSSContract.connect(committee[i]).sharePK(
          BigIntToHex(UInt8ToBigInt(ethers.utils.randomBytes(BITS / 8)) % P)
        )
      ).to.be.revertedWith(
        i == committee.length - 1
          ? "Phase is not KEY_COLLECTION"
          : "Already set public key"
      );
    }
    expect(await PVSSContract.phase()).to.equal(1);
  });

  it("Should behave correctly after calling shareKeys from client", async () => {
    await shareKeys(PVSSContract, committee, publicKeys);
    expect(await PVSSContract.remainingToSet()).to.equal(0);
    expect(await PVSSContract.phase()).to.equal(1);
    for (let i = 0; i < committee.length; i++) {
      expect(await PVSSContract.committeePKs(i)).to.equal(
        BigIntToHex(publicKeys[i])
      );
      expect(
        await PVSSContract.committeeMemberSet(committee[i].address)
      ).to.equal(true);
      await expect(
        PVSSContract.connect(committee[i]).sharePK(
          BigIntToHex(UInt8ToBigInt(ethers.utils.randomBytes(BITS / 8)) % P)
        )
      ).to.be.revertedWith("Phase is not KEY_COLLECTION");
    }
  });
});
