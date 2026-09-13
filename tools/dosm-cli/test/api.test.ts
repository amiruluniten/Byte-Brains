import { describe, expect, it } from "vitest";
import { AxiError } from "axi-sdk-js";
import { buildApiUrl, queryDataset, fetchAllRecords } from "../src/api.ts";

describe("buildApiUrl", () => {
  it("encodes the documented query parameters", () => {
    const url = new URL(
      buildApiUrl({
        id: "fuelprice",
        filters: ["level@series_type"],
        dateStart: "2024-01-01",
        dateEnd: "2024-12-31",
        sort: "-date",
        limit: 5,
        fields: ["date", "ron95"],
        range: "year[2020:2024]",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://api.data.gov.my/data-catalogue");
    expect(url.searchParams.get("id")).toBe("fuelprice");
    expect(url.searchParams.get("meta")).toBe("true");
    expect(url.searchParams.get("filter")).toBe("level@series_type");
    expect(url.searchParams.get("date_start")).toBe("2024-01-01@date");
    expect(url.searchParams.get("date_end")).toBe("2024-12-31@date");
    expect(url.searchParams.get("sort")).toBe("-date");
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("include")).toBe("date,ron95");
    expect(url.searchParams.get("range")).toBe("year[2020:2024]");
  });

  it("keeps an explicit date column when given", () => {
    const url = new URL(buildApiUrl({ id: "x", dateStart: "2020@year" }));
    expect(url.searchParams.get("date_start")).toBe("2020@year");
  });
});

describe("queryDataset error translation", () => {
  it("surfaces 429 with retry info and --wait hint", async () => {
    const impl = async () =>
      new Response('{"detail":"Request was throttled."}', {
        status: 429,
        headers: { "retry-after": "58" },
      });
    try {
      await queryDataset({ id: "fuelprice" }, { noCache: true, cacheDir: "/tmp/x", fetchImpl: impl });
      expect.unreachable();
    } catch (e) {
      const err = e as AxiError;
      expect(err.code).toBe("RATE_LIMITED");
      expect(err.message).toContain("retry in ~58s");
      expect(err.suggestions.join(" ")).toContain("--wait");
    }
  });

  it("translates 400 details into a validation error", async () => {
    const impl = async () =>
      new Response(
        JSON.stringify({ status_code: 400, details: ["Query parameter 'id' is required."] }),
        { status: 400 },
      );
    try {
      await queryDataset({ id: "fuelprice" }, { noCache: true, cacheDir: "/tmp/x", fetchImpl: impl });
      expect.unreachable();
    } catch (e) {
      const err = e as AxiError;
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.message).toContain("id");
    }
  });

  it("wraps the full record set for downloads (no limit param)", async () => {
    let url = "";
    const impl = async (u: string | URL) => {
      url = String(u);
      return new Response(JSON.stringify({ meta: { total: 2 }, data: [{ a: 1 }, { a: 2 }] }), { status: 200 });
    };
    const res = await fetchAllRecords({ id: "fuelprice" }, { noCache: true, cacheDir: "/tmp/x", fetchImpl: impl });
    expect(res.data).toHaveLength(2);
    expect(url).not.toContain("limit=");
    expect(url).toContain("meta=true");
  });
});
