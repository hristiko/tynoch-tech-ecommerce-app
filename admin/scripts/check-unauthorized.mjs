const base = process.env.ADMIN_BASE_URL || "http://localhost:3001";

for (const pathname of [
  "/api/admin/overview",
  "/api/admin/sales?source=all",
  "/api/admin/products",
  "/api/admin/categories",
  "/api/admin/users",
  "/api/admin/users/acct-00000000-0000-0000-0000-000000000000",
  "/api/admin/shopping",
  "/api/admin/shopping/guest-00000000-0000-0000-0000-000000000000",
]) {
  const response = await fetch(`${base}${pathname}`, {
    headers: { Accept: "application/json" },
    redirect: "manual",
  });
  if (response.status !== 401) {
    console.error(`FAIL: Expected 401 for anonymous access to ${pathname}, got ${response.status}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: Anonymous visitor is denied access to ${pathname} (401).`);
  }
}
