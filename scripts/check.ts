import "dotenv/config";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const KEY = process.env.API_KEY ?? "";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`, detail ?? "");
  }
}

async function call(
  method: string,
  path: string,
  options: { body?: unknown; key?: string | null; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: any; headers: Headers }> {
  const headers: Record<string, string> = { ...options.headers };
  const key = options.key === undefined ? KEY : options.key;

  if (key !== null) headers["X-API-Key"] = key;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const init: RequestInit = { method, headers };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${BASE}${path}`, init);

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  return { status: res.status, body, headers: res.headers };
}

const future = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

async function main() {
  const slots = Array.from({ length: 10 }, (_, i) => ({
    id: `s${i + 1}`,
    provider: i < 5 ? "Dr Ade" : "Dr Bello",
    start: future(60 + i * 30),
    end: future(90 + i * 30)
  }));

  await call("POST", "/reset", {
    body: {
      slots: [
        ...slots,
        {
          id: "past",
          provider: "Dr Ade",
          start: new Date(Date.now() - 3_600_000).toISOString(),
          end: new Date(Date.now() - 1_800_000).toISOString()
        }
      ]
    }
  });

  console.log("\nWeb bridge");
  const webList = await call("GET", "/web/slots", { key: null });
  check("browser bridge serves slots without a client key", webList.status === 200);
  check("browser bridge returns the same slot shape", Array.isArray(webList.body?.slots));

  const webReset = await call("POST", "/web/reset", {
    key: null,
    body: { slots: [] }
  });
  check("browser bridge never exposes /reset", webReset.status === 404);

  console.log("\nLevel 1");
  const list = await call("GET", "/slots");
  check("GET /slots returns 200", list.status === 200);
  check("wraps slots in an object", Array.isArray(list.body?.slots));
  check("orders earliest first", list.body.slots[0].id === "past");
  check(
    "slot shape",
    ["id", "provider", "start", "end", "available"].every((k) => k in list.body.slots[0])
  );

  const filtered = await call("GET", "/slots?provider=Dr%20Bello");
  check(
    "provider filter is exact",
    filtered.body.slots.every((s: any) => s.provider === "Dr Bello")
  );

  const created = await call("POST", "/bookings", {
    body: { slot_id: "s1", name: "Ada Obi", email: "ada@example.com" }
  });
  check("POST /bookings returns 201", created.status === 201, created.body);
  check("booking id present", typeof created.body?.id === "string");
  check("status confirmed", created.body?.status === "confirmed");

  const fetched = await call("GET", `/bookings/${created.body.id}`);
  check("GET /bookings/:id returns it", fetched.status === 200);
  check("GET /bookings/:id 404s unknown", (await call("GET", "/bookings/nope")).status === 404);

  const afterBook = await call("GET", "/slots");
  check(
    "booked slot is unavailable",
    afterBook.body.slots.find((s: any) => s.id === "s1")?.available === false
  );

  console.log("\nLevel 2");
  check("missing key is 401", (await call("GET", "/slots", { key: null })).status === 401);
  check("wrong key is 401", (await call("GET", "/slots", { key: "nope" })).status === 401);
  check(
    "missing name is 400",
    (await call("POST", "/bookings", { body: { slot_id: "s2", email: "a@b.co" } })).status === 400
  );
  check(
    "empty name is 400",
    (await call("POST", "/bookings", { body: { slot_id: "s2", name: "   ", email: "a@b.co" } }))
      .status === 400
  );
  check(
    "invalid email is 400",
    (await call("POST", "/bookings", { body: { slot_id: "s2", name: "A", email: "nope" } }))
      .status === 400
  );
  check(
    "unknown slot is 404",
    (
      await call("POST", "/bookings", {
        body: { slot_id: "nope", name: "A", email: "a@b.co" },
        headers: { "X-API-Key": KEY }
      })
    ).status === 404
  );
  check(
    "started slot is 400",
    (
      await call("POST", "/bookings", {
        body: { slot_id: "past", name: "A", email: "a@b.co" }
      })
    ).status === 400
  );

  const normalised = await call("POST", "/bookings", {
    body: { slot_id: "s3", name: "  Ada Obi  ", email: "  ADA@Example.COM " }
  });
  check("trims name", normalised.body?.name === "Ada Obi", normalised.body);
  check("lowercases email", normalised.body?.email === "ada@example.com", normalised.body);

  console.log("\nLevel 3");
  check(
    "second booking is 409",
    (
      await call("POST", "/bookings", {
        body: { slot_id: "s1", name: "Bob", email: "bob@example.com" }
      })
    ).status === 409
  );

  const burst = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      call("POST", "/bookings", {
        body: { slot_id: "s4", name: `Racer ${i}`, email: `racer${i}@example.com` }
      })
    )
  );
  check(
    "exactly one wins a 20-way race",
    burst.filter((r) => r.status === 201).length === 1,
    burst.map((r) => r.status)
  );

  const cancelled = await call("DELETE", `/bookings/${created.body.id}`);
  check("cancel returns cancelled booking", cancelled.body?.status === "cancelled", cancelled.body);
  check(
    "cancel frees the slot",
    (await call("GET", "/slots")).body.slots.find((s: any) => s.id === "s1")?.available === true
  );
  check(
    "cancel again is 409",
    (await call("DELETE", `/bookings/${created.body.id}`)).status === 409
  );
  check("cancel unknown is 404", (await call("DELETE", "/bookings/nope")).status === 404);

  const rebooked = await call("POST", "/bookings", {
    body: { slot_id: "s1", name: "Ada Obi", email: "second@example.com" }
  });
  check("freed slot can be rebooked", rebooked.status === 201, rebooked.body);

  console.log("\nLevel 4");
  const idemBody = { slot_id: "s5", name: "Idem User", email: "idem@example.com" };
  const first = await call("POST", "/bookings", {
    body: idemBody,
    headers: { "Idempotency-Key": "key-1" }
  });
  const replay = await call("POST", "/bookings", {
    body: idemBody,
    headers: { "Idempotency-Key": "key-1" }
  });
  check("first idempotent request 201", first.status === 201);
  check("replay returns same status", replay.status === first.status);
  check("replay returns same booking id", replay.body?.id === first.body?.id);

  const concurrently = await Promise.all(
    Array.from({ length: 3 }, () =>
      call("POST", "/bookings", {
        body: { slot_id: "s6", name: "Concurrent Idem", email: "cidem@example.com" },
        headers: { "Idempotency-Key": "key-2" }
      })
    )
  );
  check(
    "concurrent same-key requests agree",
    new Set(concurrently.map((r) => r.body?.id)).size === 1 &&
      concurrently.every((r) => r.status === 201),
    concurrently.map((r) => [r.status, r.body?.id])
  );

  check(
    "same key, different body is 422",
    (
      await call("POST", "/bookings", {
        body: { slot_id: "s5", name: "Other", email: "idem@example.com" },
        headers: { "Idempotency-Key": "key-1" }
      })
    ).status === 422
  );

  const pageEmail = "pager@example.com";
  for (const slot of ["s7", "s8", "s9", "s10"]) {
    await call("POST", "/bookings", {
      body: { slot_id: slot, name: "Pager", email: pageEmail }
    });
  }

  const p1 = await call("GET", `/bookings?email=${pageEmail}&limit=2`);
  check("page 1 has 2 bookings", p1.body?.bookings?.length === 2, p1.body);
  check("page 1 has a cursor", typeof p1.body?.next_cursor === "string");

  const p2 = await call(
    "GET",
    `/bookings?email=${pageEmail}&limit=2&cursor=${encodeURIComponent(p1.body.next_cursor)}`
  );
  check("page 2 has different bookings", p2.body?.bookings?.[0]?.id !== p1.body.bookings[0].id);

  const p3 = await call(
    "GET",
    `/bookings?email=${pageEmail}&limit=2&cursor=${encodeURIComponent(p2.body.next_cursor)}`
  );
  check("last page has next_cursor null", p3.body?.next_cursor === null, p3.body);

  const allSeen = [...p1.body.bookings, ...p2.body.bookings, ...p3.body.bookings];
  check("pagination has no duplicates", new Set(allSeen.map((b: any) => b.id)).size === 4);
  check(
    "pagination is oldest first",
    allSeen.every(
      (b: any, i: number) =>
        i === 0 || new Date(b.created_at).getTime() >= new Date(allSeen[i - 1].created_at).getTime()
    )
  );
  check(
    "email match ignores case",
    (await call("GET", `/bookings?email=${pageEmail.toUpperCase()}`)).status === 200
  );
  check("limit 0 is 400", (await call("GET", `/bookings?email=${pageEmail}&limit=0`)).status === 400);
  check(
    "limit 51 is 400",
    (await call("GET", `/bookings?email=${pageEmail}&limit=51`)).status === 400
  );
  check(
    "limit abc is 400",
    (await call("GET", `/bookings?email=${pageEmail}&limit=abc`)).status === 400
  );
  check("missing email is 400", (await call("GET", "/bookings")).status === 400);

  console.log("\nLevel 5");
  const spamEmail = "spam@example.com";
  const attempts = [];
  for (let i = 0; i < 5; i += 1) {
    attempts.push(
      await call("POST", "/bookings", {
        body: { slot_id: "s2", name: "", email: spamEmail }
      })
    );
  }
  const sixth = await call("POST", "/bookings", {
    body: { slot_id: "s2", name: "Spam", email: spamEmail }
  });

  check("first five attempts are not 429", attempts.every((r) => r.status !== 429), attempts.map((r) => r.status));
  check("sixth attempt is 429", sixth.status === 429, sixth.body);
  check(
    "429 sends Retry-After",
    Number(sixth.headers.get("retry-after")) >= 1,
    sixth.headers.get("retry-after")
  );
  check(
    "other emails still work",
    (
      await call("POST", "/bookings", {
        body: { slot_id: "s2", name: "Fine", email: "fine@example.com" }
      })
    ).status !== 429
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
