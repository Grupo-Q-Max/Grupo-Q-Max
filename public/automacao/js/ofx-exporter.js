function generateOFX(transactions, finalBalance = 0) {
    function formatOFXDate(dateStr) {
        if (!dateStr) return '20260101120000[-3:BRT]';
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return `${parts[2]}${parts[1]}${parts[0]}120000[-3:BRT]`;
        }
        return '20260101120000[-3:BRT]';
    }

    const todayStr = '20261005120000[-3:BRT]';
    let ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <DTSERVER>${todayStr}</DTSERVER>
      <LANGUAGE>POR</LANGUAGE>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>1</TRNUID>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKACCTFROM>
          <BANKID>033</BANKID>
          <ACCTID>1</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>${todayStr}</DTSTART>
          <DTEND>${todayStr}</DTEND>
`;

    transactions.forEach((t, i) => {
        const amt = (t.type === 'DEBITO' ? -Math.abs(t.amount) : Math.abs(t.amount)).toFixed(2);
        const trntype = t.type === 'DEBITO' ? 'DEBIT' : 'CREDIT';
        let desc = (t.description || '').replace(/[&<>'"]/g, '').substring(0, 255);
        let fitid = t.id ? t.id.replace(/[^a-zA-Z0-9]/g, '') : `tx${i}${Math.random().toString().substring(2, 6)}`;
        ofx += `          <STMTTRN>
            <TRNTYPE>${trntype}</TRNTYPE>
            <DTPOSTED>${formatOFXDate(t.date)}</DTPOSTED>
            <TRNAMT>${amt}</TRNAMT>
            <FITID>${fitid}</FITID>
            <MEMO>${desc}</MEMO>
          </STMTTRN>\n`;
    });

    ofx += `        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>${finalBalance.toFixed(2)}</BALAMT>
          <DTASOF>${todayStr}</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

    return ofx;
}

function downloadContaAzulOfx(transactions, filename = 'extrato.ofx') {
    const ofxData = generateOFX(transactions);
    const blob = new Blob([ofxData], { type: 'application/x-ofx' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
