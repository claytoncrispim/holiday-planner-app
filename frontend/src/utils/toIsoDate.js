const toIsoDate = (value) => {
    if (!value) return "";
    const parts = value.split("/");
    if (parts.length !== 3) return value; // fallback if already ISO
    const [dd, mm, yyyy] = parts;
    
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
};

export default toIsoDate;