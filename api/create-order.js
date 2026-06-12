const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: "Method structural protocol injection blocked." });

  const { amount, userId } = req.body;
  if (!amount || !userId) return res.status(400).json({ error: "Missing identity context or transactional volume values." });

  const orderId = "ZAPORD_" + crypto.randomBytes(8).toString('hex').toUpperCase();
  const targetPayload = {
    orderId,
    amount: parseFloat(amount),
    status: "PAYMENT_PENDING",
    userId,
    timestamp: Date.now(),
    gatewayCallbackUri: `https://${req.headers.host || 'localhost'}/api/verify-payment?id=${orderId}`
  };

  // Integration interface simulation hook with backend infrastructure providers
  return res.status(200).json({
    success: true,
    orderId,
    amount: targetPayload.amount,
    paymentGatewayUrl: `https://api.zapupi.net/pay/gateway?order=${orderId}&amt=${amount}`
  });
};
