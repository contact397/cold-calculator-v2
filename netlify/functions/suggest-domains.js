export default async (req) => {
  const { primaryDomain, numDomains } = await req.json();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a cold email deliverability expert. Given the primary business domain "${primaryDomain}", suggest exactly ${numDomains} alternative sending domains. Rules:\n- Use common prefixes/suffixes like: try, go, get, use, hello, meet, hi, with, by, team, mail, outreach, hq\n- Keep the core brand name recognisable\n- Return ONLY a JSON array of domain strings, nothing else`
      }]
    })
  });

  const data = await response.json();
  return new Response(data.content[0].text, {
    headers: { "Content-Type": "application/json" }
  });
};

export const config = { path: "/api/suggest-domains" };