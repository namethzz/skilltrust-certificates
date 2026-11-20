// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

contract SkillTrustCertificates {
    struct Course {
        string title;
        string description;
    }

    struct Certificate {
        string courseCode;
        address recipient;
        address issuer;
        bytes32 documentHash;
        uint64 issuedAt;
        uint64 revokedAt;
    }

    address public immutable admin;
    mapping(address => bool) public issuers;
    mapping(string => Course) public courses;
    mapping(string => Certificate) public certificates;
    mapping(address => string[]) private recipientCodes;

    event CourseCreated(string code, string title);
    event IssuerUpdated(address indexed account, bool allowed);
    event CertificateIssued(string code, address indexed recipient, address indexed issuer);
    event CertificateRevoked(string code, uint64 revokedAt);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Admin only");
        _;
    }

    function setIssuer(address account, bool allowed) external onlyAdmin {
        require(account != address(0), "Invalid wallet");
        issuers[account] = allowed;
        emit IssuerUpdated(account, allowed);
    }

    function createCourse(string calldata code, string calldata title, string calldata description)
        external onlyAdmin
    {
        require(validCode(code), "Invalid course code");
        require(bytes(courses[code].title).length == 0, "Course already exists");
        require(bytes(title).length > 0 && bytes(title).length <= 240, "Invalid title length");
        require(bytes(description).length > 0 && bytes(description).length <= 1200, "Invalid description length");
        courses[code] = Course(title, description);
        emit CourseCreated(code, title);
    }

    function issueCertificate(
        string calldata code, string calldata courseCode, address recipient, bytes32 documentHash
    ) external {
        require(msg.sender == admin || issuers[msg.sender], "Issuer only");
        require(validCode(code), "Invalid certificate code");
        require(certificates[code].recipient == address(0), "Certificate already exists");
        require(bytes(courses[courseCode].title).length != 0, "Unknown course");
        require(recipient != address(0), "Invalid wallet");
        require(documentHash != bytes32(0), "Invalid document hash");

        certificates[code] = Certificate(courseCode, recipient, msg.sender, documentHash, uint64(block.timestamp), 0);
        recipientCodes[recipient].push(code);
        emit CertificateIssued(code, recipient, msg.sender);
    }

    function revokeCertificate(string calldata code) external onlyAdmin {
        Certificate storage certificate = certificates[code];
        require(certificate.recipient != address(0), "Unknown certificate");
        require(certificate.revokedAt == 0, "Already revoked");
        certificate.revokedAt = uint64(block.timestamp);
        emit CertificateRevoked(code, certificate.revokedAt);
    }

    function certificateCount(address account) external view returns (uint256) {
        return recipientCodes[account].length;
    }

    function certificateCodeAt(address account, uint256 index) external view returns (string memory) {
        return recipientCodes[account][index];
    }

    function validCode(string calldata code) private pure returns (bool) {
        bytes calldata value = bytes(code);
        if (value.length == 0 || value.length > 32) return false;
        for (uint256 i = 0; i < value.length; ++i) {
            bytes1 c = value[i];
            if (!(c >= 0x41 && c <= 0x5a || c >= 0x30 && c <= 0x39 || c == 0x2d)) return false;
        }
        return true;
    }
}
