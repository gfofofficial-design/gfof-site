// Reviewed account SQL fingerprints; LF normalization only. No runtime file lookup.
const data = {
  "history": [
    {
      "name": "append",
      "args": "jsonb, integer, text, jsonb",
      "names": [
        "s",
        "p_n",
        "p_h",
        "e"
      ],
      "returns": "jsonb",
      "language": "plpgsql",
      "definer": true,
      "volatility": "v",
      "sha256": "1bd8ebd59c027ffb46a715fde70a590081f0b74f0d3b5559477d43c1001daa9c"
    },
    {
      "name": "check_chain",
      "args": "jsonb, jsonb, integer, text",
      "names": [
        "s",
        "rows",
        "floor_n",
        "floor_h"
      ],
      "returns": "jsonb",
      "language": "plpgsql",
      "definer": false,
      "volatility": "i",
      "sha256": "758edb412ec5878f76c8e77961d05913c3c1d18af945da5c37d6e334d88fd255"
    },
    {
      "name": "event_value",
      "args": "jsonb",
      "names": [
        "e"
      ],
      "returns": "jsonb",
      "language": "plpgsql",
      "definer": false,
      "volatility": "i",
      "sha256": "21bf6deeaeb937bc17fd724fa865e68834f94ba4149aac3c5f7790fb04cba255"
    },
    {
      "name": "history_bootstrap",
      "args": "jsonb",
      "names": [
        "s"
      ],
      "returns": "void",
      "language": "plpgsql",
      "definer": true,
      "volatility": "v",
      "sha256": "41691db1e0f428635767cfccefe8f1e043f3440849e1a999c72a436eca7a4840"
    },
    {
      "name": "history_mode",
      "args": "jsonb, boolean, boolean",
      "names": [
        "s",
        "on_value",
        "admissions"
      ],
      "returns": "void",
      "language": "plpgsql",
      "definer": true,
      "volatility": "v",
      "sha256": "a2f6f4c6fb19178ff7ecbab9701ea18483e73263ad76ec813c7fb5dc38a5fb9b"
    },
    {
      "name": "record_value",
      "args": "jsonb, integer, text, jsonb",
      "names": [
        "s",
        "n",
        "prev",
        "e"
      ],
      "returns": "jsonb",
      "language": "plpgsql",
      "definer": false,
      "volatility": "i",
      "sha256": "7b556c3a8648df6523f71dddb89f3248314b3effc6e8c05c39d1e4ce2e7fa8e6"
    },
    {
      "name": "scope_ok",
      "args": "jsonb",
      "names": [
        "s"
      ],
      "returns": "boolean",
      "language": "sql",
      "definer": false,
      "volatility": "i",
      "sha256": "a5557d3d8a3be384ab6edc1b6145e7aff06595148e3f849b341458d67627b2f5"
    },
    {
      "name": "snapshot",
      "args": "jsonb",
      "names": [
        "s"
      ],
      "returns": "jsonb",
      "language": "plpgsql",
      "definer": true,
      "volatility": "v",
      "sha256": "59313dd3aa0826661f62c3d7f446ef20725c7635939ab3fb964224205b2c97b5"
    }
  ],
  "ack": [
    {
      "name": "ack_advance",
      "args": "jsonb, integer, text, jsonb",
      "names": [
        "s",
        "p_n",
        "p_h",
        "rows"
      ],
      "returns": "jsonb",
      "language": "plpgsql",
      "definer": true,
      "volatility": "v",
      "sha256": "c921c9a648d1ff3b4dc3f5648ad7e770855301ddb6b6fb957750b1c0f5f787da"
    },
    {
      "name": "ack_bootstrap",
      "args": "jsonb",
      "names": [
        "s"
      ],
      "returns": "void",
      "language": "plpgsql",
      "definer": true,
      "volatility": "v",
      "sha256": "7a4d9d8076cffe5cea7345b14d77b4b7e090f2e9790604c50c8235932492cc3f"
    },
    {
      "name": "ack_mode",
      "args": "jsonb, boolean",
      "names": [
        "s",
        "on_value"
      ],
      "returns": "void",
      "language": "plpgsql",
      "definer": true,
      "volatility": "v",
      "sha256": "ad7ef196e4805033114cd8304f7c8eafa24a2e7bc0e91d040331fe6b19a3c6f5"
    },
    {
      "name": "ack_read",
      "args": "jsonb",
      "names": [
        "s"
      ],
      "returns": "jsonb",
      "language": "plpgsql",
      "definer": true,
      "volatility": "s",
      "sha256": "bc442732235a043704fa46d4a0cb1f866eb438f7589fb47d01173a2c912b61c6"
    },
    {
      "name": "check_chain",
      "args": "jsonb, jsonb, integer, text",
      "names": [
        "s",
        "rows",
        "floor_n",
        "floor_h"
      ],
      "returns": "jsonb",
      "language": "plpgsql",
      "definer": false,
      "volatility": "i",
      "sha256": "758edb412ec5878f76c8e77961d05913c3c1d18af945da5c37d6e334d88fd255"
    },
    {
      "name": "event_value",
      "args": "jsonb",
      "names": [
        "e"
      ],
      "returns": "jsonb",
      "language": "plpgsql",
      "definer": false,
      "volatility": "i",
      "sha256": "21bf6deeaeb937bc17fd724fa865e68834f94ba4149aac3c5f7790fb04cba255"
    },
    {
      "name": "record_value",
      "args": "jsonb, integer, text, jsonb",
      "names": [
        "s",
        "n",
        "prev",
        "e"
      ],
      "returns": "jsonb",
      "language": "plpgsql",
      "definer": false,
      "volatility": "i",
      "sha256": "7b556c3a8648df6523f71dddb89f3248314b3effc6e8c05c39d1e4ce2e7fa8e6"
    },
    {
      "name": "scope_ok",
      "args": "jsonb",
      "names": [
        "s"
      ],
      "returns": "boolean",
      "language": "sql",
      "definer": false,
      "volatility": "i",
      "sha256": "a5557d3d8a3be384ab6edc1b6145e7aff06595148e3f849b341458d67627b2f5"
    }
  ]
};
function freeze(value){if(value && typeof value === "object"){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export default freeze(data);
