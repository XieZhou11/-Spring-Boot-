package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.modules.dto.AddressDTO;
import com.handcraft.platform.modules.entity.ShippingAddress;
import com.handcraft.platform.modules.mapper.ShippingAddressMapper;
import com.handcraft.platform.modules.mapper.UserAccountMapper;
import com.handcraft.platform.modules.service.ShippingAddressService;
import com.handcraft.platform.modules.vo.AddressVO;
import java.util.List;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 用户行锁串行化地址额度与默认切换；不访问或改写任何订单快照。 */
@Service
public class ShippingAddressServiceImpl implements ShippingAddressService {
    private static final Logger LOGGER = LoggerFactory.getLogger(ShippingAddressServiceImpl.class);
    private final UserAccountMapper accounts;
    private final ShippingAddressMapper addresses;

    public ShippingAddressServiceImpl(UserAccountMapper accounts, ShippingAddressMapper addresses) {
        this.accounts=accounts;
        this.addresses=addresses;
    }

    @Override public List<AddressVO> list(Long userId) {
        LOGGER.info("收货地址查询开始：userId={}",userId);
        try {
            var result=addresses.list(userId).stream().map(this::view).toList();
            LOGGER.info("收货地址查询完成：userId={}, count={}",userId,result.size());
            return result;
        } catch (RuntimeException e) {
            LOGGER.error("收货地址查询异常：stage=读取本人列表, userId={}",userId,SafeLog.exception(e));
            throw e;
        }
    }

    @Override
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public AddressVO create(Long userId, AddressDTO input) {
        return mutate("新增",userId,null,()->{
            int count=addresses.count(userId);
            if(count>=10) throw new BusinessException(CommonErrorCode.CONFLICT,"收货地址最多 10 条，请先删除不再使用的地址");
            var address=new ShippingAddress(); address.setUserId(userId); fill(address,input);
            address.setDefaultAddress(count==0 || input.isDefaultAddress());
            if(address.isDefaultAddress()) addresses.clearDefault(userId);
            requireOne(addresses.insert(address));
            LOGGER.info("收货地址新增已写入：userId={}, addressId={}, default={}",userId,address.getId(),address.isDefaultAddress());
            return view(address);
        });
    }

    @Override
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public AddressVO update(Long userId,Long id,AddressDTO input) {
        return mutate("修改",userId,id,()->{
            var address=owned(userId,id);
            boolean targetDefault=address.isDefaultAddress() || input.isDefaultAddress();
            if(targetDefault) addresses.clearDefault(userId);
            fill(address,input); address.setDefaultAddress(targetDefault);
            requireOne(addresses.update(address));
            return view(address);
        });
    }

    @Override
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public void delete(Long userId,Long id) {
        mutate("删除",userId,id,()->{
            var address=owned(userId,id);
            requireOne(addresses.delete(userId,id));
            if(address.isDefaultAddress()) {
                var next=addresses.lockNewest(userId);
                if(next!=null) {
                    requireOne(addresses.setDefault(userId,next.getId()));
                    LOGGER.info("删除默认地址后已选择替代：userId={}, addressId={}",userId,next.getId());
                }
            }
            return null;
        });
    }

    @Override
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public AddressVO setDefault(Long userId,Long id) {
        return mutate("设置默认",userId,id,()->{
            var address=owned(userId,id);
            if(!address.isDefaultAddress()) {
                addresses.clearDefault(userId);
                requireOne(addresses.setDefault(userId,id));
                address.setDefaultAddress(true);
            }
            return view(address);
        });
    }

    /** 所有入口经代理开启事务后，先锁用户再检查地址；成功只在提交后记录。 */
    private <T> T mutate(String action,Long userId,Long id,Supplier<T> work) {
        LOGGER.info("收货地址{}开始：userId={}, addressId={}",action,userId,id);
        String stage="锁定账号";
        try {
            if(accounts.lockById(userId)==null) throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
            stage="校验归属、数量及写入地址";
            LOGGER.info("收货地址{}账号锁定完成：userId={}, addressId={}",action,userId,id);
            T result=work.get();
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { LOGGER.info("收货地址{}完成：userId={}, addressId={}",action,userId,id); }
                @Override public void afterCompletion(int status) {
                    if(status==STATUS_ROLLED_BACK) LOGGER.warn("收货地址{}事务回滚：userId={}, addressId={}",action,userId,id);
                    else if(status==STATUS_UNKNOWN) LOGGER.error("收货地址{}提交结果未知：userId={}, addressId={}",action,userId,id);
                }
            });
            return result;
        } catch(BusinessException e) {
            LOGGER.warn("收货地址{}失败：stage={}, userId={}, addressId={}, reason={}",action,stage,userId,id,e.getMessage());
            throw e;
        } catch(RuntimeException e) {
            LOGGER.error("收货地址{}异常：stage={}, userId={}, addressId={}",action,stage,userId,id,SafeLog.exception(e));
            throw e;
        }
    }
    private ShippingAddress owned(Long userId,Long id) {
        var address=addresses.lockOwned(userId,id);
        if(address==null) throw new BusinessException(CommonErrorCode.NOT_FOUND);
        return address;
    }
    private void fill(ShippingAddress target,AddressDTO input) {
        target.setRecipientName(input.getRecipientName()); target.setPhone(input.getPhone());
        target.setProvince(input.getProvince()); target.setCity(input.getCity()); target.setDistrict(input.getDistrict());
        target.setDetailAddress(input.getDetailAddress());
    }
    private AddressVO view(ShippingAddress address) {
        return new AddressVO(address.getId().toString(),address.getRecipientName(),address.getPhone(),address.getProvince(),
                address.getCity(),address.getDistrict(),address.getDetailAddress(),address.isDefaultAddress());
    }
    private static void requireOne(int rows) { if(rows!=1) throw new IllegalStateException("地址写入未生效"); }
}
