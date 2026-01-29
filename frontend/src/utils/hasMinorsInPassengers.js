// Utility function to check for minors in passengers object
const hasMinorsInPassengers = (passengers) => {
  if (!passengers) return false;

  return (
    (passengers.children ?? 0) > 0 ||
    (passengers.infants ?? 0) > 0 ||
    (passengers.youngAdults ?? 0) > 0
  );
};

export default hasMinorsInPassengers;