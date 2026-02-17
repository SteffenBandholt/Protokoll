const { initDatabase } = require("./database");

function _normText(v) {
  return String(v ?? "").trim();
}

function getUserProfile() {
  const db = initDatabase();
  const row = db
    .prepare(
      `
      SELECT id, name1, name2, street, zip, city
      FROM user_profile
      WHERE id = 1
    `
    )
    .get();

  return row || null;
}

function upsertUserProfile({ name1, name2, street, zip, city }) {
  const db = initDatabase();
  const now = new Date().toISOString();

  const n1 = _normText(name1);
  const n2 = _normText(name2);
  const st = _normText(street);
  const zp = _normText(zip);
  const ct = _normText(city);

  db.prepare(
    `
    INSERT INTO user_profile (
      id,
      name1,
      name2,
      street,
      zip,
      city,
      created_at,
      updated_at
    )
    VALUES (1, @name1, @name2, @street, @zip, @city, @now, @now)
    ON CONFLICT(id) DO UPDATE SET
      name1 = excluded.name1,
      name2 = excluded.name2,
      street = excluded.street,
      zip = excluded.zip,
      city = excluded.city,
      updated_at = excluded.updated_at
  `
  ).run({
    name1: n1,
    name2: n2,
    street: st,
    zip: zp,
    city: ct,
    now,
  });

  return getUserProfile();
}

module.exports = {
  getUserProfile,
  upsertUserProfile,
};
