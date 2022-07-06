// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct Secret {
    uint256[] A;
    uint256[] B;
    uint256[] V;
    uint256 S;
    uint256 revealBlock;

    // State
    uint256 gracePeriod;
    bool[] revealedSecret;
    uint256[] secret;
}

enum PVSSPhase {
    KEY_COLLECTION,
    SECRET_SHARING
}

contract PVSS {
    // TODO: change constants
    uint256 public constant P = 0xFFFF;
    uint256 public constant G = 2;
    uint256 public constant H = 4;
    // TODO: allow users to define this on a secret-by-secret basis?
    uint256 public constant GRACE_PERIOD = 1000;
    uint256 public immutable threshold;

    PVSSPhase public phase;

    // Committee membership
    address[] public committeeAddresses;
    mapping(address => uint256) public indexOfInCommittee;
    mapping(address => bool) public committeeHasAddress;

    // Committee public keys
    uint256[] public committeePKs;
    uint256 public remainingToSet;
    mapping(address => bool) public committeeMemberSet;

    Secret[] public secrets;

    constructor(address[] memory _committeeAddresses) {
        threshold = _committeeAddresses.length / 2 + 1;
        committeeAddresses = _committeeAddresses;

        phase = PVSSPhase.KEY_COLLECTION;
        committeePKs = new uint256[](committeeAddresses.length);
        remainingToSet = committeeAddresses.length;
        for (uint256 i = 0; i < committeeAddresses.length; i++) {
            committeeHasAddress[committeeAddresses[i]] = true;
            indexOfInCommittee[committeeAddresses[i]] = i;
        }
    }

    function sharePK(uint256 pk) public onlyKeyCollectionPhase onlyCommittee {
        // NOTE: If some committee members sends the wrong public key, it's over!
        require(!committeeMemberSet[msg.sender], "Already set public key");
        require(pk < P, "Invalid public key");

        committeePKs[indexOfInCommittee[msg.sender]] = pk;
        --remainingToSet;
        committeeMemberSet[msg.sender] = true;

        if (remainingToSet == 0) {
            phase = PVSSPhase.SECRET_SHARING;
        }
    }

    function shareSecret(
        uint256[] memory A,
        uint256[] memory B,
        uint256[] memory F,
        uint256 S,
        uint256[][] memory R,
        uint256[] memory C,
        uint256 revealBlock
    ) public onlySecretSharingPhase returns (uint256 secretID) {
        require(
            committeeAddresses.length == A.length &&
                A.length == B.length &&
                B.length == R.length &&
                R.length == C.length,
            "Lengths of A, B, R, H must equal number of committee members"
        );
        require(F.length == threshold, "Length of F must equal threshold");

        uint256[] memory V = _computeV(S, F, committeeAddresses.length);
        for (uint256 i = 0; i < committeeAddresses.length; i++) {
            _verifyShareNIZK(V[i], A[i], B[i], R[i], C[i], committeePKs[i]);
        }

        Secret memory secret = Secret(
            A,
            B,
            V,
            S,
            revealBlock,
            0,
            new bool[](committeeAddresses.length),
            new uint256[](committeeAddresses.length)
        );
        secrets.push(secret);
        secretID = secrets.length - 1;
    }

    function startReveal(uint256 secretID) public onlySecretSharingPhase {
        require(secretID < secrets.length, "Invalid secret ID");
        require(secrets[secretID].gracePeriod == 0, "Grace period already set");
        require(
            block.number > secrets[secretID].revealBlock,
            "Secret is still in timelock"
        );
        secrets[secretID].gracePeriod = block.number + GRACE_PERIOD;
    }

    function revealShare(uint256 secretID, uint256 secretShare)
        public
        onlySecretSharingPhase
        onlyCommittee
    {
        require(
            block.number < secrets[secretID].gracePeriod,
            "Grace period over"
        );
        uint256 senderIndex = indexOfInCommittee[msg.sender];
        require(
            !secrets[secretID].revealedSecret[senderIndex],
            "Secret already revealed"
        );
        require(
            _modExp(G, secretShare, P) == secrets[secretID].V[senderIndex],
            "Invalid secret share"
        );
        secrets[secretID].revealedSecret[senderIndex] = true;
        secrets[secretID].secret[senderIndex] = secretShare;
    }

    function claimSecret(uint256 secretID)
        public
        onlySecretSharingPhase
        returns (uint256 secret, address[] memory delinquentCommitteeMembers)
    {
        // TODO: interpolation and check number of revealed secrets
    }

    function _computeV(
        uint256 S,
        uint256[] memory F,
        uint256 length
    ) internal pure returns (uint256[] memory) {
        uint256[] memory V = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            V[i] = S;
            uint256 x = (i + 1);
            for (uint256 j = 0; j < F.length; j++) {
                V[i] *= (F[j] * x) % P;
                V[i] %= P;
                x *= (i + 1);
                x %= P;
            }
        }
        return V;
    }

    function _verifyShareNIZK(
        uint256 V,
        uint256 A,
        uint256 B,
        uint256[] memory R,
        uint256 C,
        uint256 Y
    ) internal pure {
        uint256[] memory th = new uint256[](256);
        uint256[] memory tg = new uint256[](256);
        for (uint256 i = 0; i < 256; i++) {
            if ((C >> i) & 1 == 1) {
                th[i] = (_modExp(H, R[i], P) * A) % P;
                tg[i] = _modExp(V, B * _modExp(Y, R[i], P), P);
            } else {
                th[i] = _modExp(H, R[i], P);
                tg[i] = _modExp(G, _modExp(Y, R[i], P), P);
            }
        }
        uint256 expectedHash = uint256(keccak256(abi.encode(V, A, B, th, tg)));
        require(expectedHash == C, "Invalid NIZK proof");
    }

    function _modExp(
        uint256 base,
        uint256 exp,
        uint256 mod
    ) internal pure returns (uint256) {
        // TODO: use EIP-198 precompile instead
        uint256 result = 1;
        while (exp > 0) {
            if (exp & 1 == 1) {
                result = (result * base) % mod;
            }
            base = (base * base) % mod;
            exp >>= 1;
        }
        return result;
    }

    modifier onlyKeyCollectionPhase() {
        require(
            phase == PVSSPhase.KEY_COLLECTION,
            "Phase is not KEY_COLLECTION"
        );
        _;
    }

    modifier onlySecretSharingPhase() {
        require(
            phase == PVSSPhase.SECRET_SHARING,
            "Phase is not SECRET_SHARING"
        );
        _;
    }

    modifier onlyCommittee() {
        require(committeeHasAddress[msg.sender], "msg.sender not in committee");
        _;
    }
}
