package com.handcraft.platform.modules.mapper;

import org.apache.ibatis.annotations.*;

/** 不接收完整材料、账号或密钥，日志详情只保存必要对象编号。 */
@Mapper
public interface OperationLogMapper {
    /** 明确保存经过业务层选择的内容，不接受完整请求或敏感资料。 */
    @Insert("INSERT INTO operation_log(operator_id,operator_type,target_type,target_id,action,before_status,after_status,reason,detail,result) VALUES(#{operatorId},#{operatorType},#{targetType},#{targetId},#{action},#{before},#{after},#{reason},#{detail},'SUCCESS')")
    int insertDetail(@Param("operatorId")Long operatorId,@Param("operatorType")String operatorType,@Param("targetType")String targetType,@Param("targetId")Long targetId,@Param("action")String action,@Param("before")String before,@Param("after")String after,@Param("reason")String reason,@Param("detail")String detail);
    @Insert("INSERT INTO operation_log(operator_id,operator_type,target_type,target_id,action,before_status,after_status,reason,detail,result) VALUES(#{operatorId},#{operatorType},#{targetType},#{targetId},#{action},#{before},#{after},#{reason},JSON_OBJECT('targetId',CAST(#{targetId} AS CHAR)),'SUCCESS')")
    int insert(@Param("operatorId")Long operatorId,@Param("operatorType")String operatorType,@Param("targetType")String targetType,@Param("targetId")Long targetId,@Param("action")String action,@Param("before")String before,@Param("after")String after,@Param("reason")String reason);
}
