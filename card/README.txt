WEMBLAZING — NFC CARD

Contenuto:
- index.html
- enrico-pio-esposto.vcf

Per pubblicarla sul sito statico attuale:
1. Nel repository "wemblazing", crea una cartella chiamata "card".
2. Carica dentro la cartella questi due file.
3. Fai commit su main.
4. Vercel ridistribuirà automaticamente il sito.
5. La pagina sarà raggiungibile da:
   https://wemblazing.vercel.app/card/

Per la carta NFC:
- Scrivi come URL: https://wemblazing.vercel.app/card/
- Usa un record NDEF di tipo URL/URI.
- Dopo aver verificato tutto, puoi bloccare il tag in sola lettura solo se sei sicuro di non voler cambiare l'URL.

Nota:
Il contenuto della pagina può essere aggiornato in futuro senza riprogrammare la carta, finché l'URL /card/ resta lo stesso.
