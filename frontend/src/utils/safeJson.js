export async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}