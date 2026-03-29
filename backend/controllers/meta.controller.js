const { asyncHandler } = require("../utils/async-handler");
const { listCountries } = require("../utils/countries");

const getCountries = asyncHandler(async (_req, res) => {
  const countries = await listCountries();
  res.status(200).json({ countries });
});

module.exports = {
  getCountries,
};
