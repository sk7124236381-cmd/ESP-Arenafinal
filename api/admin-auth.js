const crypto = require('crypto');

// Simulated memory store for demo purposes. Replace with production database logic as needed.
let globalAdminDatabaseInstance = null;

function secureHash(password) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET || 'fallback-secret-key-32-chars-long!')
               .update(password)
               .digest('hex');
}

function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
  const payloadBase = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'fallback-secret-key-32-chars-long!')
                          .update(`${header}.${payloadBase}`)
                          .digest('base64url');
  return `${header}.${payloadBase}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const expectedSign = crypto.createHmac('sha256', process.env.JWT_SECRET || 'fallback-secret-key-32-chars-long!')
                               .update(`${header}.${payload}`)
                               .digest('base64url');
    if (signature !== expectedSign) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const { action } = req.query;

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET' && action === 'check-status') {
    return res.status(200).json({ setupRequired: globalAdminDatabaseInstance === null });
  }

  if (req.method === 'POST' && action === 'setup') {
    if (globalAdminDatabaseInstance !== null) {
      return res.status(403).json({ error: "Initialization access expired. Administrative account already provisioned." });
    }
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Missing required profile creation attributes." });

    globalAdminDatabaseInstance = {
      uid: "admin_" + crypto.randomBytes(4).toString('hex'),
      name,
      email,
      passwordHash: secureHash(password),
      role: "root-admin"
    };
    return res.status(200).json({ success: true, message: "Administrative system initialized successfully." });
  }

  if (req.method === 'POST' && action === 'login') {
    const { email, password } = req.body;
    if (!globalAdminDatabaseInstance || globalAdminDatabaseInstance.email !== email) {
      return res.status(401).json({ error: "Invalid administrative credentials." });
    }
    if (secureHash(password) !== globalAdminDatabaseInstance.passwordHash) {
      return res.status(401).json({ error: "Invalid administrative credentials." });
    }
    const token = generateToken({ uid: globalAdminDatabaseInstance.uid, role: globalAdminDatabaseInstance.role });
    res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Secure`);
    return res.status(200).json({ success: true, token });
  }

  return res.status(404).json({ error: "Endpoint path or action verb not found." });
};
