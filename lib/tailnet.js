/* Tailscale integration for --tailnet: bind to this machine's tailscale IP
 * and print the MagicDNS URL if available. */
import { execFileSync } from "node:child_process";

export function tailnetAddress() {
  let ip;
  try {
    ip = execFileSync("tailscale", ["ip", "-4"], { encoding: "utf8" })
      .trim().split("\n")[0];
  } catch {
    throw new Error("cannot get tailscale IP — is tailscale running?");
  }
  let urlHost = ip;
  try {
    const status = JSON.parse(
      execFileSync("tailscale", ["status", "--json"], { encoding: "utf8" }));
    const dns = status?.Self?.DNSName;
    if (dns) urlHost = dns.replace(/\.$/, "");
  } catch { /* IP stays */ }
  return { ip, urlHost };
}
