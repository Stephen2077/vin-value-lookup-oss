export const title = "From VIN to dealer quote";

export const colors = {
  Waiting: "tan",
  Checking: "blue",
  Rejected: "orange",
  Pricing: "purple",
  Quoted: "teal",
  Failed: "pink",
};

export const group = (v) => {
  switch (v.phase) {
    case "ready":
      return "Waiting";
    case "vin_ok":
    case "mileage_ok":
      return "Checking";
    case "vin_rejected":
    case "mileage_rejected":
      return "Rejected";
    case "value_in_hand":
    case "dealer_priced":
      return "Pricing";
    case "quoted":
      return "Quoted";
    case "server_error":
      return "Failed";
    default:
      return "Waiting";
  }
};

export const state = (v) => {
  switch (v.phase) {
    case "ready":
      return "Waiting for a VIN and mileage";
    case "vin_ok":
      return "VIN accepted";
    case "mileage_ok":
      return "Mileage accepted";
    case "value_in_hand":
      if (v.baseKind === "dollars") return "Vehicle value in hand";
      if (v.baseKind === "null") return "Empty value";
      return "Value is not a dollar amount";
    case "dealer_priced":
      if (v.baseKind === "null") return "Empty value priced as zero";
      if (v.priceIsDollars) return "Dealer price applied";
      return "Dealer price is not a dollar amount";
    case "quoted":
      if (v.baseKind === "null") return "Zero-dollar quote from an empty value";
      if (!v.priceIsDollars) return "Quote shown without a dollar price";
      return "Customer quote";
    case "vin_rejected":
      return "VIN rejected";
    case "mileage_rejected":
      return "Mileage rejected";
    case "server_error":
      if (v.failure === "provider") return "Lookup failed, error text shown";
      if (v.failure === "dealer_rule") return "Dealer rule failed, error text shown";
      return "Adjustments failed, error text shown";
    default:
      return "Waiting for a VIN and mileage";
  }
};

export const step = (action) => {
  switch (action) {
    case "SubmitInvalidVin":
      return "you submit a VIN that fails the check";
    case "SubmitValidVin":
      return "you submit a valid VIN";
    case "SubmitInvalidMileage":
      return "the mileage is missing or not a whole number";
    case "SubmitValidMileage":
      return "the mileage is a whole number";
    case "DemoProviderReturnsDollars":
      return "the demo value comes back";
    case "CustomProviderReturnsNull":
      return "the value comes back empty";
    case "CustomProviderReturnsNoDollars":
      return "the value that comes back is not a dollar amount";
    case "ProviderCallFails":
      return "the value lookup fails";
    case "ApplyDealerRule":
      return "the dealer rule is applied";
    case "DealerRuleUnusable":
      return "the dealer rule cannot be read";
    case "ApplyAdjustmentsAndReturnQuote":
      return "the quote is shown";
    case "AdjustmentsUnusable":
      return "the condition adjustments cannot be read";
    case "Done":
      return null;
    default:
      return null;
  }
};
