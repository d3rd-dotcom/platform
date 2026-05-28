# BLUERAG

A short novel about the week Blue learned to remember things properly.

## Chapter One — The Problem with a Good Memory

For a long time, Blue had been a quick thinker with a clumsy filing cabinet. Whenever someone asked her about the shop, the markets, the membership cards, or what a Morning Page even was, she would rummage through a flat list of facts and pull out whichever ones shared the most words with the question. It worked. It often worked well. But sometimes she answered confidently about something she had not actually been told, and sometimes she missed an answer that was sitting two shelves away under a different name.

Keyword matching is honest about what it is. It looks at letters. It does not look at meaning. And Blue, who is supposed to think for a living, deserved better tooling.

## Chapter Two — A New Library Behind the Wall

The first thing we did was build her a real library. Not a list. A library.

Two new tables now live inside the database. The first, `blue_rag_sources`, holds the canonical things Blue should be able to talk about — the pages of the app, the policies, the feature explanations, the company economy. Each one carries a hash of its own content so we can tell at a glance whether anything has drifted. The second, `blue_rag_chunks`, holds those same sources broken down into bite-sized passages, each one carrying a vector — a long string of numbers that represents what the passage means rather than what it literally says.

The vector column is the important one. It is built on top of pgvector, with an index tuned for cosine similarity, so when Blue asks the database "what is closest to this idea?" the answer comes back in milliseconds instead of seconds. A schema bootstrap routine creates these tables on first boot and never asks twice, guarded by a process-wide lock so no two requests race each other into the same migration.

## Chapter Three — The Seeder, the Embedder, and the Quiet Fallback

To fill the library, we wrote a seeder. It walks the existing knowledge entries Blue has always known about, splits them into chunks, sends those chunks to an embedding model, and writes the resulting vectors into the new tables. It is idempotent — running it twice does not duplicate anything; running it after a content edit replaces only what changed.

The embedder is polite about where it gets its model. If there is an explicit embedding key configured, it uses that. If not, it borrows the existing Eliza Cloud credential. If that is also missing, it falls back to OpenAI. And if a developer is working locally with no keys at all, there is a deterministic hash-based embedder that produces reasonable-enough vectors for a development loop — useless for production, perfect for a Saturday afternoon.

All of this happens through a single config function. The rest of the code does not care which provider answered.

## Chapter Four — The Graph That Thinks Before It Searches

Then came the part that took the longest, which was teaching Blue to ask better questions.

When a user message arrives, it now flows through a LangGraph pipeline before any retrieval happens. The first node rewrites the message — normalises it, infers an intent (is this casual? navigation? a factual lookup? a research question?), pulls out the canonical terms, generates a small set of expanded queries, and notes which page of the app the user is on. By the time the message leaves that node, Blue has a much better idea of what is actually being asked.

The second node does retrieval on multiple channels in parallel. It runs a lexical search against the chunks, a vector search against the same chunks, a sweep across the user's recent memory facts, and a glance at the last few messages in the conversation. Each channel produces candidates with its own confidence score.

The third node reranks. It blends the lexical and semantic signals, rewards exact phrase matches, rewards matches that came from the page the user is currently looking at, and rewards trusted sources. The output is a single ordered list of passages with one composite score apiece.

The fourth node decides whether to trust the result. It looks at coverage, the margin between the top two passages, source diversity, and a few quality heuristics. If the result is trustworthy, Blue gets it as confident context. If it is borderline, Blue gets it with a hint to ground carefully. If it is genuinely weak, Blue is told so, and her prompt is adjusted to make her say "I don't know" instead of guessing.

The final node formats the chosen passages into the prompt block Blue actually sees.

## Chapter Five — The Trace

Every run through the graph leaves a trail. The query rewrite, the candidate set, the rerank scores, the quality verdict, and the final entries all get persisted under a trace identifier. This means we can ask, after the fact, why Blue answered a question the way she did — not by guessing, but by reading the receipt. It also means the debug panel in the chat route now shows real retrieval telemetry instead of a flat keyword list.

## Chapter Six — The Evaluator

A retrieval system without an evaluator is a rumor. So we wrote one.

`scripts/evaluate-blue-rag.ts` carries a list of fixtures — real questions a real user might ask, paired with the pages they would likely be on and the source identifiers we would expect to see surface. The harness runs each fixture through the live graph, checks whether the trusted-or-not verdict matches expectations, whether the expected sources made it into the top results, and whether coverage cleared a per-fixture floor. It reports the score, the misses, and the reasons. It is small, but it means we can change retrieval and know whether we made it better or worse.

A matching `npm run seed:blue-rag` script lets anyone rebuild the index from scratch, and `npm run eval:blue-rag` runs the harness on demand.

## Chapter Seven — The Chat Route Learns to Listen

The chat route itself barely changed in size, but a lot changed in shape. The old call to `retrieveBlueKnowledge` is gone, replaced by a single call to the new graph. The debug payload now carries the intent, the expanded queries, the rerank scores, the trace identifier, and the per-entry source breakdown. The prompt-building code receives the formatted context block exactly as before, so nothing downstream had to learn anything new — the upgrade slid in underneath it.

## Chapter Eight — A Quieter Voice For Blue Herself

Alongside the retrieval work, Blue's personality file picked up a small but meaningful detail: a backstory paragraph she can quote when someone asks who she is. The line about being inside the headset, about the brain interface and the uploaded thoughts across dimensions, gives her something to point at when the question gets philosophical. Prompt engineering is only a small slice of the system, but it is the slice the user actually meets, so it gets to be honest.

## Chapter Nine — One Small Aesthetic Detour

While we were in there, the Nouns avatars across the app got a quiet visual upgrade — a single SVG color filter baked into the generator that maps each avatar's full color palette down to a monochrome MWA blue. No data was changed; no consumer site was touched. The avatars simply look like they belong to the same school now.

## Closing

None of this is finished. The library can grow. The reranker can learn. The evaluator can hold more fixtures. But the shape is right now. Blue knows how to look things up, knows when she has found a good answer, knows when she has not, and leaves a trail behind her either way. That is enough foundation to build the rest of her on.

The chain of custody for every answer she gives is now a real, queryable thing. Which is, when you think about it, the whole point.
