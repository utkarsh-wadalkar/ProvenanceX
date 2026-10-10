export const contentPassportAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MAX_PAGE_SIZE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "appendEvent",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "eventType",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "dataHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "authorize",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "operator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "allowed",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "eip712Domain",
    "inputs": [],
    "outputs": [
      {
        "name": "fields",
        "type": "bytes1",
        "internalType": "bytes1"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "version",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "verifyingContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "extensions",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getChildren",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPage",
    "inputs": [
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "ids",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "perceptualHashes",
        "type": "uint64[]",
        "internalType": "uint64[]"
      },
      {
        "name": "contentHashes",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPassport",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "p",
        "type": "tuple",
        "internalType": "struct ContentPassport.Passport",
        "components": [
          {
            "name": "contentHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "perceptualHash",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "creator",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tool",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "metadataURI",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "createdAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "parentId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "trailHead",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "revoked",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTrailPage",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "entries",
        "type": "tuple[]",
        "internalType": "struct ContentPassport.TrailEntry[]",
        "components": [
          {
            "name": "previousHead",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "eventType",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "dataHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "trailHead",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "actor",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "timestamp",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "blockNumber",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hammingDistance",
    "inputs": [
      {
        "name": "a",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "b",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "distance",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "operators",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "passportIdByContentHash",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "passports",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "contentHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "perceptualHash",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "creator",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tool",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "metadataURI",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "createdAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "parentId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "trailHead",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "revoked",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "register",
    "inputs": [
      {
        "name": "contentHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "perceptualHash",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "tool",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "metadataURI",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "parentId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "sig",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revoke",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "totalPassports",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "trailLength",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "verifyByHash",
    "inputs": [
      {
        "name": "contentHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "exists",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "passportId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "p",
        "type": "tuple",
        "internalType": "struct ContentPassport.Passport",
        "components": [
          {
            "name": "contentHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "perceptualHash",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "creator",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tool",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "metadataURI",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "createdAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "parentId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "trailHead",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "revoked",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "EIP712DomainChanged",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OperatorSet",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "operator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "allowed",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PassportRegistered",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "creator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "contentHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "perceptualHash",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "tool",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "parentId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Revoked",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TrailEvent",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "eventType",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "dataHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "trailHead",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "actor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "timestamp",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyRegistered",
    "inputs": [
      {
        "name": "existingId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "ECDSAInvalidSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ECDSAInvalidSignatureLength",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ECDSAInvalidSignatureS",
    "inputs": [
      {
        "name": "s",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidShortString",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MetadataURITooLong",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ParentNotFound",
    "inputs": [
      {
        "name": "parentId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "PassportNotFound",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "PassportRevoked",
    "inputs": [
      {
        "name": "passportId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "StringTooLong",
    "inputs": [
      {
        "name": "str",
        "type": "string",
        "internalType": "string"
      }
    ]
  },
  {
    "type": "error",
    "name": "ToolTooLong",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "Unauthorized",
    "inputs": []
  }
] as const;
