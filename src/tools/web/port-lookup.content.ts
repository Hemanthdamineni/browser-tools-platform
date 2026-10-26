/**
 * Editorial content for the port-lookup tool page.
 *
 * Kept out of ``port-lookup.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Looking a port up by number or name',
      body: 'Type a number and the table narrows to the matching ports, so 22 returns SSH and 443 returns HTTPS with their protocol and a one-line description of what each service does. Type a word instead and the tool matches it against both the service name and the description, so a search for database finds every entry whose text mentions it, and leaving the field empty browses the whole table. Each result keeps the same four columns — port, protocol, service and description — and the stats report how many rows came back.',
    },
    {
      heading: 'The ports covered',
      body: 'The built-in list holds around 160 well-known and registered entries spanning the everyday stack: web and mail on 80, 443, 25 and 587; remote access on 22 and 3389; databases such as 1433 for MSSQL and 1521 for Oracle; container and orchestration services; developer servers like 3000 and 8080; and infrastructure from DNS on 53 to NTP on 123 and OpenVPN on 1194. Entries record the protocol, since a single number can mean different things over TCP and UDP, and the description is kept short so a scan of the table stays quick.',
    },
    {
      heading: 'Why the note when nothing matches',
      body: 'A port number with no entry does not mean the port is unused — applications can bind any number, and thousands are in use that are neither registered nor well known. So a number-only miss returns an empty table with a note explaining that the port may still be active, rather than implying it is free. The same is true of a name search that finds nothing: no registered service from the list matches, and that is the whole of the answer.',
    },
    {
      heading: 'Where the data lives',
      body: 'The table ships with the page, so a lookup runs entirely in the tab with no request and works offline — handy when you are debugging a firewall or a container and want an answer without a network call. Nothing you type is uploaded, and the tool never probes a live system, so it answers the documentation question "what usually runs here?" rather than "what is running right now?".',
    },
  ],
  faq: [
    {
      q: 'Why do two services sometimes share a port?',
      a: 'TCP and UDP are separate namespaces, and some historical services registered both. The Protocol column shows whether an entry applies to TCP, UDP, or both.',
    },
    {
      q: 'What if my port is not listed?',
      a: 'The table covers about 160 well-known and registered ports, not every number. A missing port means no well-known service from the bundled list is registered to it, and the tool says so — it may still be in use by an application you are debugging, which the note points out.',
    },
    {
      q: 'Is this the IANA assignment?',
      a: 'It is a curated subset reflecting common services, so the definitions are kept short and readable rather than the full IANA registry. That makes it fast to scan for the everyday case while still covering web, mail, databases, dev servers and infrastructure.',
    },
  ],
} as const;
