//Скрипт 1. Передача результату опрацювання документа в ESIGN
function onTaskExecuteVerifyRequest(routeStage) {
  debugger;
  if (routeStage.executionResult == "executed") {
    if (!EdocsApi.getAttributeValue("RegDate").value || !EdocsApi.getAttributeValue("RegNumber").value) {
      throw "Спочатку зареєструйте документ!";
    }
    sendCommand(routeStage);
  }
}

function onTaskExecutedVerifyRequest(routeStage) {
  sendComment(routeStage);
}
function sendCommand(routeStage) {
  debugger;
  var command;
  var comment;
  if (routeStage.executionResult == "executed") {
    command = "CompleteTask";
    signatures = EdocsApi.getSignaturesAllFiles();
  } else {
    command = "RejectTask";
    comment = routeStage.comment;
  }

  var DocCommandData = {
    extSysDocID: CurrentDocument.id,
    extSysDocVersion: CurrentDocument.version,
    command: command,
    legalEntityCode: EdocsApi.getAttributeValue("HomeOrgEDRPOU").value,
    userEmail: EdocsApi.getEmployeeDataByEmployeeID(CurrentUser.employeeId).email,
    userTitle: CurrentUser.fullName,
    comment: comment,
    signatures: signatures,
  };

  routeStage.externalAPIExecutingParams = {
    externalSystemCode: "ESIGN1", // код зовнішньої системи
    externalSystemMethod: "integration/processDocCommand", // метод зовнішньої системи
    data: DocCommandData, // дані, що очікує зовнішня система для заданого методу
    executeAsync: false, // виконувати завдання асинхронно
  };
}

function sendComment(routeStage) {
  debugger;
  var orgCode = EdocsApi.getAttributeValue("OrgCode").value;
  var orgShortName = EdocsApi.getAttributeValue("OrgShortName").value;
  if (!orgCode || !orgShortName) {
    return;
  }
  var comment = `Ваш запит прийнято та зареєстровано за № ${EdocsApi.getAttributeValue("RegNumber").value} від ${moment(new Date(EdocsApi.getAttributeValue("RegDate").value)).format("DD.MM.YYYY")}`;
  var methodData = {
    extSysDocId: CurrentDocument.id,
    eventType: "CommentAdded",
    comment: comment,
    partyCode: orgCode,
    userTitle: CurrentUser.name,
    partyName: orgShortName,
    occuredAt: new Date(),
  };
  EdocsApi.runExternalFunction("ESIGN1", "integration/processEvent", methodData);
}

//Скрипт 2. Зміна властивостей атрибутів при створені документа
function setInitialRequired() {
  if (CurrentDocument.inExtId) {
    controlRequired("DataInspection");
    controlRequired("DateContract");
    controlRequired("NumberContract");
    controlRequired("PlaceInspection");
    controlRequired("NumberLocomotive");
    controlRequired("DataInspection");
    controlRequired("SeriesLocomotive");
    controlRequired("NumberLocom");
    controlRequired("edocsDocSum");
    controlRequired("RequestVATPerecent");
  } else {
    controlRequired("DataInspection", false);
    controlRequired("DateContract", false);
    controlRequired("NumberContract", false);
    controlRequired("PlaceInspection", false);
    controlRequired("NumberLocomotive", false);
    controlRequired("DataInspection", false);
    controlRequired("SeriesLocomotive", false);
    controlRequired("NumberLocom", false);
    controlRequired("edocsDocSum", false);
    controlRequired("RequestVATPerecent", false);
  }
}

function controlRequired(CODE, required = true) {
  const control = EdocsApi.getControlProperties(CODE);
  control.required = required;
  EdocsApi.setControlProperties(control);
}

function onCardInitialize() {
  setInitialRequired();
  CreateAccountTask();
}

//Скрипт 3. Неможливість внесення змін в поля карточки
function CreateAccountTask() {
  const stateTask = EdocsApi.getCaseTaskDataByCode("CreateAccount").state;
  if (stateTask == "assigned" || stateTask == "inProgress" || stateTask == "completed'") {
    controlDisabled("DateContract");
    controlDisabled("NumberContract");
    controlDisabled("DataInspection");
    controlDisabled("Comment");
    controlDisabled("NumberLocomotive");
    controlDisabled("PlaceInspection");
    controlDisabled("SeriesLocomotive");
    controlDisabled("Comment");
    controlDisabled("NumberLocom");
    controlDisabled("Section");
    controlDisabled("edocsDocSum");
    controlDisabled("RequestVATPerecent");

    controlRequired("Connection");
  } else {
    controlDisabled("edocsIncomeDocumentNumber", false);
    controlDisabled("edocsIncomeDocumentDate", false);
    controlDisabled("DataInspection", false);
    controlDisabled("DateContract", false);
    controlDisabled("NumberContract", false);
    controlDisabled("NumberLocomotive", false);
    controlDisabled("PlaceInspection", false);
    controlDisabled("SeriesLocomotive", false);
    controlDisabled("Comment", false);
    controlDisabled("NumberLocom", false);
    controlDisabled("Section", false);
    controlDisabled("edocsDocSum", false);
    controlDisabled("RequestVATPerecent", false);

    controlRequired("Connection", false);
  }
}

function controlDisabled(CODE, disabled = true) {
  const control = EdocsApi.getControlProperties(CODE);
  control.disabled = disabled;
  EdocsApi.setControlProperties(control);
}

//4. // Вирахування суми ПДВ заявки
function calculationRequestAmount() {
  let VATpercentage = 0;
  const attrVATAmount = EdocsApi.getAttributeValue("RequestVATAmmount");
  const attrVATpercentage = EdocsApi.getAttributeValue("RequestVATPerecent");
  const attrContractAmount = EdocsApi.getAttributeValue("edocsDocSum");
  const attrAmountOutVAT = EdocsApi.getAttributeValue("RequestAmmountOutVat");

  switch (attrVATpercentage.value) {
    case "20%": // if (x === 'если сумма НДС=20%')
      VATpercentage = 1.2;
      break;

    case "7%": // if (x === 'если сумма НДС=7%')
      VATpercentage = 1.07;
      break;
  }

  if (attrVATpercentage.value === null || attrContractAmount.value === null) {
    // если нет ставки НДС и суммы, то укажем ноль в сумме НДС и без НДС
    attrVATAmount.value = 0;
    attrAmountOutVAT.value = 0;
  } else if (VATpercentage == 0) {
    attrVATAmount.value = 0;
    attrAmountOutVAT.value = attrContractAmount.value;
  } else {
    attrAmountOutVAT.value = Math.floor((100 * attrContractAmount.value) / VATpercentage) / 100;
    attrVATAmount.value = attrContractAmount.value - attrAmountOutVAT.value;
  }

  EdocsApi.setAttributeValue(attrVATAmount);
  EdocsApi.setAttributeValue(attrAmountOutVAT);
}

function onChangeedocsDocSum() {
  calculationRequestAmount();
}

function onChangeRequestVATPerecent() {
  calculationRequestAmount();
}

function setContractorOnCreate(portalData) {
  debugger;
  const code = portalData.tableAttributes.filter(x => x.code == "LegalEntityCode").map(y => y.value)[0];

  try {
    const conInfo = EdocsApi.getContractorByCode(code, "debtor");
    debugger;
    if (conInfo) {
      EdocsApi.setAttributeValue({ code: "ContractorId", value: conInfo.personId });
      EdocsApi.setAttributeValue({ code: "ContractorShortName", value: conInfo.shortName });
      EdocsApi.setAttributeValue({ code: "ContractorFullName", value: conInfo.fullName });
      EdocsApi.setAttributeValue({ code: "CustomerEDRPOU", value: conInfo.code });
      EdocsApi.setAttributeValue({ code: "ContractorIPN", value: conInfo.taxId });
      EdocsApi.setAttributeValue({ code: "LegaladdressContractor", value: conInfo.legalAddress });
    }
  } catch (e) {
    EdocsApi.message(e);
  }
}

function onCreate() {
  setContractorOnCreate(EdocsApi.getInExtAttributes(CurrentDocument.id.toString()));
  setContractorOnCreateEsign();
  setContractorHome();
}

function setContractorOnCreateEsign() {
  debugger;
  try {
    const data = EdocsApi.getInExtAttributes(CurrentDocument.id.toString());
    EdocsApi.setAttributeValue({ code: "ContractorRPEmail", value: data.tableAttributes.filter(x => x.code == "ContactPersonEmail").map(y => y.value)[1] });
  } catch (e) {
    EdocsApi.setAttributeValue({ code: "ContractorRPEmail", value: "" });
  }
}

function setContractorHome() {
  debugger;
  try {
    const code = EdocsApi.getInExtAttributes(CurrentDocument.id.toString()).attributeValues.find(x => x.code == "HomeOrgEDRPOU").value;
    const data = EdocsApi.getContractorByCode(code, "homeOrganization");
    EdocsApi.setAttributeValue({ code: "OrganizationId", value: data.contractorId });
    EdocsApi.setAttributeValue({ code: "HomeName", value: data.fullName });
    EdocsApi.setAttributeValue({ code: "OrgShortName", value: data.shortName });
    EdocsApi.setAttributeValue({ code: "OrgCode", value: code });
    EdocsApi.setAttributeValue({ code: "HomeOrgIPN", value: data.taxId });
    EdocsApi.setAttributeValue({ code: "LegaladdressOrg", value: data.legalAddress });
  } catch (e) {
    EdocsApi.setAttributeValue({ code: "OrganizationId", value: "" });
    EdocsApi.setAttributeValue({ code: "HomeName", value: "" });
    EdocsApi.setAttributeValue({ code: "OrgShortName", value: "" });
    EdocsApi.setAttributeValue({ code: "OrgCode", value: "" });
    EdocsApi.setAttributeValue({ code: "HomeOrgIPN", value: "" });
    EdocsApi.setAttributeValue({ code: "LegaladdressOrg", value: "" });
  }
}
