package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.modules.service.PayeeSnapshotService;
import com.handcraft.platform.modules.service.PaymentAccountCryptoService;
import java.util.Base64;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** 收款快照解析与脱敏的唯一实现，防止订单详情与收入记录两处口径漂移。 */
@Service
public class PayeeSnapshotServiceImpl implements PayeeSnapshotService {
    private final PaymentAccountCryptoService crypto;
    private final ObjectMapper json;
    public PayeeSnapshotServiceImpl(PaymentAccountCryptoService crypto,ObjectMapper json){this.crypto=crypto;this.json=json;}

    @Override
    public PayeeSnapshot parse(String payeeSnapshot){
        try{JsonNode snapshot=json.readTree(payeeSnapshot);
            return new PayeeSnapshot(text(snapshot,"real_name"),text(snapshot,"alipay_account_ciphertext"),text(snapshot,"approved_application_id"));
        }catch(RuntimeException failure){return new PayeeSnapshot(null,null,null);}
    }
    @Override
    public String masked(String payeeSnapshot,Long creatorId){
        PayeeSnapshot snapshot=parse(payeeSnapshot);
        String name=snapshot.realName()==null?"":snapshot.realName();
        String account=crypto.decrypt(creatorId,Base64.getDecoder().decode(snapshot.accountCiphertext()));
        return (name.isEmpty()?"**":name.substring(0,1)+"**")+" / "+(account.length()<5?"****":account.substring(0,1)+"****"+account.substring(account.length()-2));
    }
    @Override
    public String plaintextAccount(String payeeSnapshot,Long creatorId){
        return crypto.decrypt(creatorId,Base64.getDecoder().decode(parse(payeeSnapshot).accountCiphertext()));
    }
    private static String text(JsonNode snapshot,String field){JsonNode value=snapshot.path(field);return value.isMissingNode()||value.asText().isEmpty()?null:value.asText();}
}
