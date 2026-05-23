/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/slotto_lottery.json`.
 */
export type SlottoLottery = {
  "address": "6mYYxtJ4NPH1oNJoy2CpJGQq6XiWCsu8iB5y6ior6TMq",
  "metadata": {
    "name": "slottoLottery",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Slotto on-chain lottery (checked-in IDL; regenerate via scripts/generate-idl.mjs)"
  },
  "instructions": [
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "teamVault",
          "type": "pubkey"
        },
        {
          "name": "buxVault",
          "type": "pubkey"
        },
        {
          "name": "setupVault",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "createDraw",
      "discriminator": [
        107,
        29,
        230,
        63,
        112,
        148,
        0,
        105
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true
        },
        {
          "name": "draw",
          "writable": true
        },
        {
          "name": "prizeVault",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "salesOpenTs",
          "type": "i64"
        },
        {
          "name": "salesCloseTs",
          "type": "i64"
        },
        {
          "name": "seedRefund",
          "type": "pubkey"
        },
        {
          "name": "seedLamports",
          "type": "u64"
        },
        {
          "name": "splRows",
          "type": {
            "vec": {
              "defined": {
                "name": "splMintArg"
              }
            }
          }
        }
      ]
    },
    {
      "name": "addSplMintToDraw",
      "discriminator": [
        158,
        82,
        68,
        38,
        174,
        100,
        173,
        217
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig"
        },
        {
          "name": "draw",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "splRow",
          "type": {
            "defined": {
              "name": "splMintArg"
            }
          }
        }
      ]
    },
    {
      "name": "buySolTickets",
      "discriminator": [
        240,
        15,
        247,
        138,
        37,
        98,
        192,
        250
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "draw",
          "writable": true
        },
        {
          "name": "prizeVault",
          "writable": true
        },
        {
          "name": "globalConfig"
        },
        {
          "name": "teamVault",
          "writable": true
        },
        {
          "name": "buxVault",
          "writable": true
        },
        {
          "name": "setupVault",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "count",
          "type": "u32"
        }
      ]
    },
    {
      "name": "buySplTickets",
      "discriminator": [
        54,
        1,
        208,
        36,
        204,
        54,
        25,
        1
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "draw",
          "writable": true
        },
        {
          "name": "globalConfig"
        },
        {
          "name": "mint"
        },
        {
          "name": "teamVault"
        },
        {
          "name": "buyerToken",
          "writable": true
        },
        {
          "name": "teamToken",
          "writable": true
        },
        {
          "name": "setupVault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "count",
          "type": "u32"
        }
      ]
    },
    {
      "name": "closeSales",
      "discriminator": [
        63,
        216,
        175,
        193,
        204,
        39,
        113,
        225
      ],
      "accounts": [
        {
          "name": "draw",
          "writable": true
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "refundEmptyDraw",
      "discriminator": [
        49,
        168,
        175,
        82,
        83,
        67,
        216,
        81
      ],
      "accounts": [
        {
          "name": "draw",
          "writable": true
        },
        {
          "name": "prizeVault",
          "writable": true
        },
        {
          "name": "seedRefund",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "requestVrf",
      "discriminator": [
        5,
        87,
        79,
        152,
        164,
        176,
        190,
        226
      ],
      "accounts": [
        {
          "name": "draw",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "settle",
      "discriminator": [
        175,
        42,
        185,
        87,
        144,
        131,
        102,
        212
      ],
      "accounts": [
        {
          "name": "draw",
          "writable": true
        },
        {
          "name": "prizeVault",
          "writable": true
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "withdrawSpl",
      "discriminator": [
        181,
        154,
        94,
        86,
        62,
        115,
        6,
        186
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig"
        },
        {
          "name": "draw"
        },
        {
          "name": "mint"
        },
        {
          "name": "splVaultAuthority"
        },
        {
          "name": "treasuryToken",
          "writable": true
        },
        {
          "name": "destinationToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "globalConfig",
      "discriminator": [
        149,
        8,
        156,
        202,
        160,
        252,
        176,
        217
      ]
    },
    {
      "name": "draw",
      "discriminator": [
        225,
        131,
        41,
        222,
        122,
        20,
        146,
        202
      ]
    },
    {
      "name": "ticketChunk",
      "discriminator": [
        40,
        18,
        133,
        144,
        73,
        179,
        60,
        4
      ]
    },
    {
      "name": "prizeVault",
      "discriminator": [
        34,
        226,
        195,
        160,
        248,
        75,
        50,
        7
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "invalidSchedule",
      "msg": "invalidSchedule"
    },
    {
      "code": 6002,
      "name": "tooManySplMints",
      "msg": "tooManySplMints"
    },
    {
      "code": 6003,
      "name": "splMintAlreadyInDraw",
      "msg": "splMintAlreadyInDraw"
    },
    {
      "code": 6004,
      "name": "unexpectedRemainingAccounts",
      "msg": "unexpectedRemainingAccounts"
    },
    {
      "code": 6005,
      "name": "invalidSplCap",
      "msg": "invalidSplCap"
    },
    {
      "code": 6006,
      "name": "invalidSplPrice",
      "msg": "invalidSplPrice"
    },
    {
      "code": 6007,
      "name": "drawIdOverflow",
      "msg": "drawIdOverflow"
    },
    {
      "code": 6008,
      "name": "wrongDrawState",
      "msg": "wrongDrawState"
    },
    {
      "code": 6009,
      "name": "outsideSalesWindow",
      "msg": "outsideSalesWindow"
    },
    {
      "code": 6010,
      "name": "invalidTicketCount",
      "msg": "invalidTicketCount"
    },
    {
      "code": 6011,
      "name": "arithmeticOverflow",
      "msg": "arithmeticOverflow"
    },
    {
      "code": 6012,
      "name": "invalidTeamVault",
      "msg": "invalidTeamVault"
    },
    {
      "code": 6013,
      "name": "invalidBuxVault",
      "msg": "invalidBuxVault"
    },
    {
      "code": 6014,
      "name": "invalidSetupVault",
      "msg": "invalidSetupVault"
    },
    {
      "code": 6015,
      "name": "invalidChunkAccounts",
      "msg": "invalidChunkAccounts"
    },
    {
      "code": 6016,
      "name": "invalidChunkAccount",
      "msg": "invalidChunkAccount"
    },
    {
      "code": 6017,
      "name": "ticketSlotOccupied",
      "msg": "ticketSlotOccupied"
    },
    {
      "code": 6018,
      "name": "mintNotInDraw",
      "msg": "mintNotInDraw"
    },
    {
      "code": 6019,
      "name": "splCapExceeded",
      "msg": "splCapExceeded"
    },
    {
      "code": 6020,
      "name": "splMintDecimalsMismatch",
      "msg": "splMintDecimalsMismatch"
    },
    {
      "code": 6021,
      "name": "invalidDrawStateForCloseSales",
      "msg": "invalidDrawStateForCloseSales"
    },
    {
      "code": 6022,
      "name": "salesPeriodNotEnded",
      "msg": "salesPeriodNotEnded"
    },
    {
      "code": 6023,
      "name": "invalidDrawStateForRefund",
      "msg": "invalidDrawStateForRefund"
    },
    {
      "code": 6024,
      "name": "refundDrawHasTickets",
      "msg": "refundDrawHasTickets"
    },
    {
      "code": 6025,
      "name": "invalidSeedRefund",
      "msg": "invalidSeedRefund"
    },
    {
      "code": 6026,
      "name": "invalidDrawStateForVrf",
      "msg": "invalidDrawStateForVrf"
    },
    {
      "code": 6027,
      "name": "vrfNeedsTickets",
      "msg": "vrfNeedsTickets"
    },
    {
      "code": 6028,
      "name": "vrfAlreadyRequested",
      "msg": "vrfAlreadyRequested"
    },
    {
      "code": 6029,
      "name": "invalidDrawStateForSettle",
      "msg": "invalidDrawStateForSettle"
    },
    {
      "code": 6030,
      "name": "vrfNotStubMode",
      "msg": "vrfNotStubMode"
    },
    {
      "code": 6031,
      "name": "settleAccountsWrongLen",
      "msg": "settleAccountsWrongLen"
    },
    {
      "code": 6032,
      "name": "emptyTicketOwner",
      "msg": "emptyTicketOwner"
    },
    {
      "code": 6033,
      "name": "winnerMismatch",
      "msg": "winnerMismatch"
    },
    {
      "code": 6034,
      "name": "invalidDrawStateForWithdrawSpl",
      "msg": "invalidDrawStateForWithdrawSpl"
    }
  ],
  "types": [
    {
      "name": "splMintArg",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "pricePerTicket",
            "type": "u64"
          },
          {
            "name": "mintDecimals",
            "type": "u8"
          },
          {
            "name": "cap",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "splMintRow",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "pricePerTicket",
            "type": "u64"
          },
          {
            "name": "mintDecimals",
            "type": "u8"
          },
          {
            "name": "padding0",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "cap",
            "type": "u32"
          },
          {
            "name": "sold",
            "type": "u32"
          },
          {
            "name": "padding1",
            "type": {
              "array": [
                "u8",
                4
              ]
            }
          }
        ]
      }
    },
    {
      "name": "draw",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "drawId",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "prizeVaultBump",
            "type": "u8"
          },
          {
            "name": "padding0",
            "type": {
              "array": [
                "u8",
                6
              ]
            }
          },
          {
            "name": "salesOpenTs",
            "type": "i64"
          },
          {
            "name": "salesCloseTs",
            "type": "i64"
          },
          {
            "name": "state",
            "type": "u8"
          },
          {
            "name": "padding1",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "totalTickets",
            "type": "u32"
          },
          {
            "name": "seedRefund",
            "type": "pubkey"
          },
          {
            "name": "splCount",
            "type": "u8"
          },
          {
            "name": "padding2",
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          },
          {
            "name": "splMintRows",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "splMintRow"
                  }
                },
                50
              ]
            }
          },
          {
            "name": "vrfRequest",
            "type": "pubkey"
          },
          {
            "name": "winningTicketId",
            "type": "u32"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "splAuthBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "globalConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "teamVault",
            "type": "pubkey"
          },
          {
            "name": "buxVault",
            "type": "pubkey"
          },
          {
            "name": "setupVault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "nextDrawId",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ticketChunk",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owners",
            "type": {
              "array": [
                "pubkey",
                256
              ]
            }
          }
        ]
      }
    },
    {
      "name": "prizeVault",
      "type": {
        "kind": "struct",
        "fields": []
      }
    }
  ]
};
