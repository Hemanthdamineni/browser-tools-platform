import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './port-lookup.meta';

/** [port, protocol, service, description] */
type Row = [number, string, string, string];

const PORTS: Row[] = [
  [20, 'TCP', 'FTP-DATA', 'File Transfer Protocol (data)'],
  [21, 'TCP', 'FTP', 'File Transfer Protocol (control)'],
  [22, 'TCP', 'SSH', 'Secure Shell — remote login, scp, git over ssh'],
  [23, 'TCP', 'Telnet', 'Telnet remote login (plaintext, insecure)'],
  [25, 'TCP', 'SMTP', 'Simple Mail Transfer Protocol (relay)'],
  [43, 'TCP', 'WHOIS', 'WHOIS directory service'],
  [53, 'TCP/UDP', 'DNS', 'Domain Name System'],
  [67, 'UDP', 'DHCP server', 'Dynamic Host Configuration Protocol (server)'],
  [68, 'UDP', 'DHCP client', 'Dynamic Host Configuration Protocol (client)'],
  [69, 'UDP', 'TFTP', 'Trivial File Transfer Protocol'],
  [79, 'TCP', 'Finger', 'Finger user information (historic)'],
  [80, 'TCP', 'HTTP', 'Hypertext Transfer Protocol'],
  [88, 'TCP', 'Kerberos', 'Kerberos authentication'],
  [110, 'TCP', 'POP3', 'Post Office Protocol v3'],
  [111, 'TCP/UDP', 'RPCBind', 'ONC RPC portmapper'],
  [113, 'TCP', 'Ident', 'Ident authentication (historic)'],
  [119, 'TCP', 'NNTP', 'Network News Transfer Protocol'],
  [123, 'UDP', 'NTP', 'Network Time Protocol'],
  [135, 'TCP', 'MSRPC', 'Microsoft RPC endpoint mapper'],
  [137, 'UDP', 'NetBIOS-NS', 'NetBIOS name service'],
  [138, 'UDP', 'NetBIOS-DGM', 'NetBIOS datagram service'],
  [139, 'TCP', 'NetBIOS-SSN', 'NetBIOS session service'],
  [143, 'TCP', 'IMAP', 'Internet Message Access Protocol'],
  [161, 'UDP', 'SNMP', 'Simple Network Management Protocol'],
  [162, 'UDP', 'SNMP trap', 'SNMP traps/notifications'],
  [179, 'TCP', 'BGP', 'Border Gateway Protocol'],
  [194, 'TCP', 'IRC', 'Internet Relay Chat'],
  [389, 'TCP/UDP', 'LDAP', 'Lightweight Directory Access Protocol'],
  [427, 'TCP/UDP', 'SLP', 'Service Location Protocol'],
  [443, 'TCP', 'HTTPS', 'HTTP over TLS/QUIC (HTTP/3 uses UDP 443)'],
  [445, 'TCP', 'SMB', 'Server Message Block over TCP'],
  [465, 'TCP', 'SMTPS', 'SMTP over implicit TLS (submission)'],
  [500, 'UDP', 'IKE', 'Internet Key Exchange (IPSec)'],
  [514, 'UDP', 'Syslog', 'BSD syslog'],
  [515, 'TCP', 'LPD', 'Line Printer Daemon'],
  [548, 'TCP', 'AFP', 'Apple Filing Protocol'],
  [554, 'TCP', 'RTSP', 'Real Time Streaming Protocol'],
  [587, 'TCP', 'SMTP submission', 'Mail submission with STARTTLS'],
  [623, 'UDP', 'IPMI', 'Intelligent Platform Management (BMC)'],
  [631, 'TCP', 'IPP', 'Internet Printing Protocol (CUPS)'],
  [636, 'TCP', 'LDAPS', 'LDAP over TLS'],
  [691, 'TCP', 'MS Exchange routing', 'Exchange link-state routing'],
  [873, 'TCP', 'rsync', 'rsync daemon'],
  [902, 'TCP', 'VMware', 'VMware virtual infrastructure'],
  [993, 'TCP', 'IMAPS', 'IMAP over TLS'],
  [995, 'TCP', 'POP3S', 'POP3 over TLS'],
  [1080, 'TCP', 'SOCKS', 'SOCKS proxy'],
  [1194, 'UDP', 'OpenVPN', 'OpenVPN default'],
  [1433, 'TCP', 'MSSQL', 'Microsoft SQL Server'],
  [1434, 'UDP', 'MSSQL browser', 'SQL Server Browser'],
  [1521, 'TCP', 'Oracle', 'Oracle database listener'],
  [1723, 'TCP', 'PPTP', 'Point-to-Point Tunneling Protocol'],
  [2049, 'TCP/UDP', 'NFS', 'Network File System'],
  [2082, 'TCP', 'cPanel', 'cPanel web interface'],
  [2083, 'TCP', 'cPanel SSL', 'cPanel web interface (TLS)'],
  [2181, 'TCP', 'ZooKeeper', 'Apache ZooKeeper client'],
  [2375, 'TCP', 'Docker', 'Docker REST API (unencrypted)'],
  [2376, 'TCP', 'Docker TLS', 'Docker REST API (TLS)'],
  [2379, 'TCP', 'etcd client', 'etcd client API'],
  [2380, 'TCP', 'etcd peer', 'etcd peer traffic'],
  [2483, 'TCP', 'Oracle TNS', 'Oracle database TNS listener'],
  [3000, 'TCP', 'Dev server', 'Common Node/React dev port (Grafana, Rails)'],
  [3001, 'TCP', 'Dev server', 'Common secondary dev/API port'],
  [3268, 'TCP', 'LDAP GC', 'Active Directory global catalog'],
  [3269, 'TCP', 'LDAPS GC', 'Global catalog over TLS'],
  [3306, 'TCP', 'MySQL', 'MySQL/MariaDB database'],
  [3389, 'TCP', 'RDP', 'Remote Desktop Protocol'],
  [3690, 'TCP', 'SVN', 'Subversion'],
  [4444, 'TCP', 'Selenium', 'Selenium WebDriver default'],
  [4505, 'TCP', 'Salt', 'Salt master publisher'],
  [4506, 'TCP', 'Salt', 'Salt master request server'],
  [5000, 'TCP', 'Flask/UPnP', 'Common Flask dev port; UPnP'],
  [5060, 'TCP/UDP', 'SIP', 'Session Initiation Protocol'],
  [5061, 'TCP', 'SIP TLS', 'SIP over TLS'],
  [5222, 'TCP', 'XMPP client', 'Jabber/XMPP client connections'],
  [5432, 'TCP', 'PostgreSQL', 'PostgreSQL database'],
  [5439, 'TCP', 'Redshift', 'Amazon Redshift'],
  [5555, 'TCP', 'ADB', 'Android Debug Bridge (TCP)'],
  [5601, 'TCP', 'Kibana', 'Kibana web interface'],
  [5672, 'TCP', 'AMQP', 'RabbitMQ / AMQP 0-9-1'],
  [5666, 'TCP', 'NRPE', 'Nagios Remote Plugin Executor'],
  [5900, 'TCP', 'VNC', 'Virtual Network Computing (display :0)'],
  [5910, 'TCP', 'VNC', 'VNC (display :1)'],
  [5984, 'TCP', 'CouchDB', 'Apache CouchDB'],
  [5985, 'TCP', 'WinRM HTTP', 'Windows Remote Management'],
  [5986, 'TCP', 'WinRM HTTPS', 'Windows Remote Management over TLS'],
  [6379, 'TCP', 'Redis', 'Redis key-value store'],
  [6443, 'TCP', 'Kubernetes API', 'Kubernetes API server (k3s default)'],
  [6566, 'TCP', 'SANE', 'Scanner Access Now Easy'],
  [6667, 'TCP', 'IRC', 'Internet Relay Chat (alternate)'],
  [7000, 'TCP', 'Cassandra', 'Apache Cassandra inter-node'],
  [7077, 'TCP', 'Spark', 'Apache Spark master'],
  [8000, 'TCP', 'Dev server', 'python -m http.server, Django, uvicorn'],
  [8008, 'TCP', 'HTTP alt', 'Alternate HTTP (Matrix Synapse, Chromecast)'],
  [8080, 'TCP', 'HTTP proxy', 'HTTP alternate / Tomcat / local proxies'],
  [8081, 'TCP', 'HTTP alt', 'HTTP alternate (dev servers)'],
  [8443, 'TCP', 'HTTPS alt', 'HTTPS alternate (web applications)'],
  [8500, 'TCP', 'Consul', 'HashiCorp Consul (HTTP API)'],
  [8600, 'UDP', 'Consul DNS', 'Consul DNS interface'],
  [8888, 'TCP', 'HTTP alt', 'Jupyter Notebook / common alt port'],
  [9000, 'TCP', 'SonarQube/PHP-FPM', 'SonarQube web, PHP-FPM, Portainer, MinIO'],
  [9001, 'TCP', 'Supervisor', 'Supervisor daemon / H2 web console'],
  [9042, 'TCP', 'Cassandra', 'Apache Cassandra client (CQL)'],
  [9090, 'TCP', 'Prometheus', 'Prometheus web UI'],
  [9092, 'TCP', 'Kafka', 'Apache Kafka broker (plaintext)'],
  [9100, 'TCP', 'JetDirect', 'HP printer / node_exporter'],
  [9200, 'TCP', 'Elasticsearch', 'Elasticsearch REST API'],
  [9300, 'TCP', 'Elasticsearch', 'Elasticsearch inter-node'],
  [9418, 'TCP', 'git daemon', 'Git protocol'],
  [9990, 'TCP', 'WildFly', 'JBoss/WildFly management'],
  [11211, 'TCP/UDP', 'Memcached', 'Memcached key-value cache'],
  [15672, 'TCP', 'RabbitMQ mgmt', 'RabbitMQ management UI'],
  [25565, 'TCP', 'Minecraft', 'Minecraft server'],
  [27017, 'TCP', 'MongoDB', 'MongoDB database'],
  [28017, 'TCP', 'MongoDB web', 'MongoDB web console'],
  [50070, 'TCP', 'Hadoop', 'Hadoop NameNode web UI'],
  /* __MORE_ROWS__ */
];

const HEADERS = ['Port', 'Protocol', 'Service', 'Description'];

function run(input: TextRunInput): TextRunResult {
  const query = input.text.trim();
  if (!query) {
    const rows = PORTS.map((r) => r.map(String));
    return {
      output: JSON.stringify({ headers: HEADERS, rows }),
      render: 'table',
      stats: { services: PORTS.length },
    };
  }

  let rows: string[][];
  if (/^\d+$/.test(query)) {
    const port = Number(query);
    if (port > 65535) {
      throw new ToolError('Port numbers range from 0 to 65535.');
    }
    rows = PORTS.filter((r) => r[0] === port).map((r) => r.map(String));
    if (!rows.length) {
      return {
        output: JSON.stringify({ headers: HEADERS, rows: [] }),
        render: 'table',
        notes: [
          `No well-known service registered for port ${port}. It may still be in use by an application.`,
        ],
      };
    }
  } else {
    const q = query.toLowerCase();
    rows = PORTS.filter(
      (r) => r[2].toLowerCase().includes(q) || r[3].toLowerCase().includes(q),
    ).map((r) => r.map(String));
    if (!rows.length) {
      return {
        output: JSON.stringify({ headers: HEADERS, rows: [] }),
        render: 'table',
        notes: [`No service matching "${query}".`],
      };
    }
  }
  return {
    output: JSON.stringify({ headers: HEADERS, rows }),
    render: 'table',
    stats: { matches: rows.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
