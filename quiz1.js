(function(){
   const APP_KEY ='_xuexitongQuizV1';
   const BOOT_TIMER_KEY ='_xuexitongQuizBootTimerV1';

   const preApp = window[APP_KEY];
   if(preApp&&typeof preApp.destroy==='function'){
       preApp.destroy();
}
   if(window[BOOT_TIMER_KEY]){
        clearInterval(window[BOOT_TIMER_KEY]);
        window[BOOT_TIMER_KEY] = null;
    }

    window._quizstop = false;

  function findAllInFrames(selector, doc = document, depth = 0, results = []) {
   if (depth > 5) return results;

   doc.querySelectorAll(selector).forEach(el => results.push(el));

   doc.querySelectorAll('iframe').forEach(frame => {
     let innerDoc = null;
     try {
       innerDoc = frame.contentDocument || frame.contentWindow?.document;
     }  catch (e) {
       return;
     }
     if (innerDoc) findAllInFrames(selector, innerDoc, depth + 1, results);
   });

  return results;
}


     async function waitForQuiz(timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (findAllInFrames('.singleQuesId').length > 0) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}




   function checkQuizPage() {
  
  const isQuiz = findAllInFrames('.singleQuesId').length > 0;
  if (!isQuiz) {
    console.log('未检测到题目页面，脚本停止运行');
    return null;
  }



  const active = document.querySelector('.posCatalog_active');
  const activeText = active ? active.textContent.replace(/\s+/g, '') : '';
  if (activeText.includes('已完成') && !activeText.includes('待完成')) {
 
    console.log('本章节测验已完成，准备切下一章节');
    return true;
  }
  
  return false;
}

    function getQuestionType(q){
      const t = (q.querySelector('.fontLabel')?.textContent || '').replace(/\s+/g, '');
      if (t.includes('判断题')) return 'judge';
      if (t.includes('单选题')) return 'single';
      if (t.includes('多选题')) return 'multi';
      return 'unknown';
    }

    function getOptions(q){
      return q.querySelectorAll('li[role=radio], li[role=checkbox]');
    }
   
    async function waitUntilAllanswered(questions, timeout = 5000) {
      const start = Date.now();
      while(Date.now() - start < timeout) {
        const all = questions.every(q =>{
          const qid = q.getAttribute('data');
          if(!qid) return false;
          const input = q.querySelector(`input[name="answer${qid}"]`);
          return input && input.value;
        });
        if (all) return true;
        await new Promise(r => setTimeout(r, 200));
      }
      return false;
    }

  
    function isAnswered(q) {
  return q.querySelectorAll('li[role=radio][aria-checked="true"], li[role=checkbox][aria-checked="true"]').length > 0;
}

function isVisible(el) {
  if (!el) return false;
  const win = el.ownerDocument.defaultView;
  const style = win.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
  

  async function doQuiz() {
    const questions = findAllInFrames('.singleQuesId')
      .filter(q => getOptions(q).length >0);

      if(questions.length ===0){
        console.log('没有可作答的题');
      return false;
    }
    

    for (let i = 0; i < questions.length; i++){
      const q = questions[i];

      if(isAnswered(q)) {
        console.log(`第 ${i + 1} 道题已作答，跳过`);
        continue;
      }

      const type = getQuestionType(q);
      const options = getOptions(q);
      

      if(options.length === 0) continue;

      const pick = options[Math.floor(Math.random() * options.length)];
      pick.click();
      

      await new Promise(r =>setTimeout(r,200));
    }

    const ok = await waitUntilAllanswered(questions);
    if(!ok) {
    
      return false;
    }
const doc = questions[0].ownerDocument;
doc.defaultView.btnBlueSubmit();
console.log('已触发提交');

let okBtn = null;
const start = Date.now();
while (Date.now() - start < 5000) {
  const btns = findAllInFrames('#popok');
  okBtn = btns.find(isVisible);
  if (okBtn) break;
  await new Promise(r => setTimeout(r, 100));
}

if (!okBtn) {
  console.log('未找到可见的确认按钮');
  return false;
}

okBtn.focus();
['mousedown', 'mouseup', 'click'].forEach(type => {
  okBtn.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: okBtn.ownerDocument.defaultView
  }));
});
console.log('已确认提交');
return true;
}

 async function waitForCurrentQuizTab(knowledgeId, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const tab = document.querySelector('#dct2') || findAllInFrames('#dct2')[0];
    if (tab) {
      const onclick = tab.getAttribute('onclick') || '';
      if (onclick.includes(knowledgeId)) return tab;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  return null;
}

 async function waitForActiveNode(knowledgeId, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const active = document.querySelector('.posCatalog_active');
    if (active && active.id.includes(knowledgeId)) return active;
    await new Promise(r => setTimeout(r, 200));
  }
  return null;
}

async function goNextQuiz() {
  const all = [...document.querySelectorAll('.posCatalog_select')];
  const active = document.querySelector('.posCatalog_active');
  const idx = all.indexOf(active);
  if (idx === -1) return false;

  for (let i = idx + 1; i < all.length; i++) {
    const node = all[i];
    const text = node.textContent.replace(/\s+/g, '');

    if (text.includes('已完成')) continue;
    if (!text.includes('待完成')) continue;

    const knowledgeId = node.id.replace(/^cur/, '');
    

    const nameEl = node.querySelector('.posCatalog_name') || node;
    nameEl.click();

    
    const activeNode = await waitForActiveNode(knowledgeId, 8000);
    if (!activeNode) {
      
      continue;
    }

    
    let quizTab = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      quizTab = await waitForCurrentQuizTab(knowledgeId, 4000);
      if (quizTab) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!quizTab) {
      console.log('本节没有测验页签，继续下一个');
      continue;
    }

    quizTab.click();
    console.log('已点击章节测验页签');

    
    let ok = await waitForQuiz(8000);
    if (!ok) {
      console.log('第一次没加载出，重试');
      quizTab.click();
      ok = await waitForQuiz(8000);
    }
    if (!ok) {
      console.log('本节测验加载失败，继续下一个');
      continue;
    }

    return true;
  }
  return false;
}

async function waitForDone(timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const active = document.querySelector('.posCatalog_active');
    const text = active ? active.textContent.replace(/\s+/g, '') : '';
    if (text.includes('已完成') && !text.includes('待完成')) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}


function removeVisiblePopups() {
  const masks = findAllInFrames('.maskDiv');
  masks.forEach(el => {
    const win = el.ownerDocument.defaultView;
    const style = win.getComputedStyle(el);
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      console.log('移除可见遮罩:', el.id, el.className);
      el.remove();
    }
  });
}

async function autoLoop(maxChapters = 50) {
  let count = 0;

  while (count < maxChapters) {
    
    if (window._quizstop) {
      console.log('用户手动停止');
      break;
    }

    
    const ok = await waitForQuiz();
    if (!ok) {
      console.log('等待测验页面超时，退出');
      break;
    }

  
    const status = checkQuizPage();
    if (status === null) {
      console.log('不在测验页，退出');
      break;
    }
   if (status === false) {
  await doQuiz();
  const done = await waitForDone();
  if (!done) { removeVisiblePopups(); break; }
} else {
  console.log('本节测验已完成，跳过');
}


removeVisiblePopups();

    
    const hasNext = await goNextQuiz();
    if (!hasNext) {
      console.log('没有下一节测验了，退出');
      break;
    }

    count++;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`循环结束，共处理 ${count} 节`);
}

  const app = {
  run: autoLoop,
  destroy() {
    window._quizstop = true;
    console.log('脚本已停止');
  }
};



    window[APP_KEY] = app;
    app.run();
})();