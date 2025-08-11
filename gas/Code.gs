const API_BASE_URL='https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/api';
const ADMIN_KEY='YOUR_ADMIN_SHARED_SECRET';
function onOpen(){SpreadsheetApp.getUi().createMenu('チェックイン').addItem('Firestoreへ反映','syncReservationToFirestore').addToUi();}
function syncReservationToFirestore(){
  const sh=SpreadsheetApp.getActiveSheet();
  const last=sh.getLastRow(); if(last<2){SpreadsheetApp.getUi().alert('データがありません'); return;}
  const vals=sh.getRange(2,1,last-1,5).getValues();
  const records=[]; for(const row of vals){const[d,rn,gn,gc,pk]=row; if(!d||!rn||!gn||!gc||!pk) continue;
    const date=(d instanceof Date)?Utilities.formatDate(d, Session.getScriptTimeZone(),'yyyy-MM-dd'):String(d);
    records.push({date, roomNumber:String(rn).trim(), guestName:String(gn).trim(), guestCount:Number(gc), passkey:String(pk).trim()});
  }
  if(records.length===0){SpreadsheetApp.getUi().alert('送信対象の行がありません'); return;}
  const res=UrlFetchApp.fetch(API_BASE_URL+'/admin/syncReservations',{method:'post',contentType:'application/json',headers:{'x-admin-key':ADMIN_KEY},payload:JSON.stringify({records}),muteHttpExceptions:true});
  if(res.getResponseCode()!==200){SpreadsheetApp.getUi().alert('エラー: '+res.getResponseCode()+'\\n'+res.getContentText()); return;}
  const body=JSON.parse(res.getContentText()); SpreadsheetApp.getUi().alert('反映完了: '+body.count+'件');
}
